// Collects the review comments on a pull request that still need triage, and replies to and reacts on them.
//
// A comment needs triage until it carries the viewer's ROCKET reaction. `collect` prints those comments as JSON,
// `reply` posts an answer and adds the ROCKET, `react` adds only the ROCKET. All GitHub access goes through `gh`.

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

type Author = { __typename: string; login: string } | null
type Commented = {
  id: string
  url: string
  body: string
  author: Author
  viewerDidAuthor: boolean
  reactionGroups: { content: string; viewerHasReacted: boolean }[]
}
type Thread = {
  id: string
  isResolved: boolean
  isOutdated: boolean
  path: string
  line: number | null
  comments: { nodes: Commented[]; pageInfo: { hasNextPage: boolean; endCursor: string } }
}

// A failure whose message is the whole story, printed without a stack trace.
class Failure extends Error {}

const commentFields = "id url body author { __typename login } viewerDidAuthor reactionGroups { content viewerHasReacted }"
const usage = "usage: node pr-comments.ts collect [pr] | reply <id> < body.md | react <id>"

function gh(args: string[]) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: "pipe", maxBuffer: 1 << 30 })
  } catch (error) {
    const { stderr, message } = error as { stderr?: string; message: string }
    throw new Failure(stderr?.trim() || message)
  }
}

function graphql(query: string, variables: Record<string, string | undefined>) {
  const args = ["api", "graphql", "-f", `query=${query}`]
  for (const [name, value] of Object.entries(variables)) if (value !== undefined) args.push("-f", `${name}=${value}`)
  return JSON.parse(gh(args)).data
}

// Returns every node of `connection` on the node `nodeId`, starting after `cursor`.
function getConnection<T>(nodeId: string, type: string, connection: string, fields: string, cursor?: string): T[] {
  const nodes: T[] = []
  do {
    const page = graphql(
      `query($id: ID!, $cursor: String) { node(id: $id) { ... on ${type} { ${connection}(first: 100, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { ${fields} } } } } }`,
      { id: nodeId, cursor },
    ).node[connection]
    nodes.push(...page.nodes)
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined
  } while (cursor)
  return nodes
}

function getThreads(pullRequestId: string) {
  const threads = getConnection<Thread>(
    pullRequestId,
    "PullRequest",
    "reviewThreads",
    `id isResolved isOutdated path line comments(first: 100) { pageInfo { hasNextPage endCursor } nodes { ${commentFields} } }`,
  )
  return threads.map(({ comments, ...thread }) => ({
    ...thread,
    comments: comments.pageInfo.hasNextPage
      ? [
          ...comments.nodes,
          ...getConnection<Commented>(thread.id, "PullRequestReviewThread", "comments", commentFields, comments.pageInfo.endCursor),
        ]
      : comments.nodes,
  }))
}

function isUntriaged(comment: Commented) {
  return !comment.viewerDidAuthor && !comment.reactionGroups.some((group) => group.content === "ROCKET" && group.viewerHasReacted)
}

// A deleted account has a null author, which GitHub shows as "ghost".
function toAuthor(author: Author) {
  return { author: author?.login ?? "ghost", bot: author?.__typename === "Bot" }
}

function collect(pullRequest?: string) {
  const pullRequestId = gh(["pr", "view", ...(pullRequest ? [pullRequest] : []), "--json", "id", "--jq", ".id"]).trim()

  const threads = getThreads(pullRequestId)
    .filter((thread) => !thread.isResolved)
    .flatMap((thread) =>
      thread.comments.filter(isUntriaged).map((comment) => ({
        id: comment.id,
        surface: "thread",
        ...toAuthor(comment.author),
        url: comment.url,
        body: comment.body,
        path: thread.path,
        line: thread.line,
        outdated: thread.isOutdated,
        thread: thread.comments.map((context) => ({ ...toAuthor(context.author), body: context.body })),
      })),
    )
  const reviews = getConnection<Commented>(pullRequestId, "PullRequest", "reviews", commentFields)
    .filter((review) => review.body.trim() && isUntriaged(review))
    .map((review) => ({ id: review.id, surface: "review", ...toAuthor(review.author), url: review.url, body: review.body }))
  const conversation = getConnection<Commented>(pullRequestId, "PullRequest", "comments", commentFields)
    .filter(isUntriaged)
    .map((comment) => ({ id: comment.id, surface: "conversation", ...toAuthor(comment.author), url: comment.url, body: comment.body }))

  console.log(JSON.stringify([...threads, ...reviews, ...conversation], null, 2))
}

function react(subjectId: string) {
  graphql(
    "mutation($subject: ID!) { addReaction(input: { subjectId: $subject, content: ROCKET }) { clientMutationId } }",
    { subject: subjectId },
  )
}

function reply(commentId: string) {
  const body = readFileSync(0, "utf8")
  if (!body.trim()) throw new Failure("reply: the reply body on stdin is empty")
  const node = graphql(
    `query($id: ID!) { node(id: $id) { __typename
      ... on PullRequestReviewComment { pullRequest { id } }
      ... on PullRequestReview { url pullRequest { id } }
      ... on IssueComment { url pullRequest { id } } } }`,
    { id: commentId },
  ).node

  let url: string
  let reacted = [commentId]
  let botThreadId: string | undefined
  if (node.__typename === "PullRequestReviewComment") {
    const thread = getThreads(node.pullRequest.id).find((thread) => thread.comments.some((comment) => comment.id === commentId))
    if (!thread) throw new Failure(`reply: no review thread holds ${commentId}`)
    url = graphql(
      "mutation($thread: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread, body: $body }) { comment { url } } }",
      { thread: thread.id, body },
    ).addPullRequestReviewThreadReply.comment.url
    // One reply answers the whole thread, so every comment in it still waiting for triage gets the ROCKET.
    reacted = [...new Set([commentId, ...thread.comments.filter(isUntriaged).map((comment) => comment.id)])]
    // A thread a person started stays open for them to resolve.
    if (thread.comments[0].author?.__typename === "Bot") botThreadId = thread.id
  } else if (node.__typename === "PullRequestReview" || node.__typename === "IssueComment") {
    // GitHub has no reply button on a review body or a conversation comment, so the reply links to what it answers.
    url = graphql(
      "mutation($subject: ID!, $body: String!) { addComment(input: { subjectId: $subject, body: $body }) { commentEdge { node { url } } } }",
      { subject: node.pullRequest.id, body: `> Re: ${node.url}\n\n${body}` },
    ).addComment.commentEdge.node.url
  } else {
    throw new Failure(`reply: ${commentId} is a ${node.__typename}, not a review comment, review, or conversation comment`)
  }

  let step = "adding the reaction"
  try {
    for (const id of reacted) react(id)
    step = "resolving the thread"
    if (botThreadId)
      graphql("mutation($thread: ID!) { resolveReviewThread(input: { threadId: $thread }) { clientMutationId } }", {
        thread: botThreadId,
      })
  } catch (error) {
    console.error(`reply: ${step} failed. The reply is already posted at ${url}`)
    throw error
  }
  console.log(url)
}

const [command, argument] = process.argv.slice(2)
try {
  if (command === "collect") collect(argument)
  else if (command === "reply" && argument) reply(argument)
  else if (command === "react" && argument) react(argument)
  else {
    console.error(usage)
    process.exitCode = 2
  }
} catch (error) {
  if (!(error instanceof Failure)) throw error
  console.error(error.message)
  process.exitCode = 1
}
