---
name: testing
description: Conventions for writing tests in any language. Use whenever you read, write, edit, or fix a test, or add coverage.
---

# Testing

Every rule here is language and test suite neutral. Translate it into the project's language, test suite, assertion library, and file layout before applying it. Examples are pseudo-code.

## 1. Read a sample of the project's tests

Read a handful of existing tests before writing one. Pick them two ways:

- The newest tests in the project. How tests get written drifts over time, and the newest ones show the current convention, not the one from three years ago.
- The tests closest to the code you are touching. A module often has its own patterns, and they only show up in the tests next door.

Done when you can name the conventions those tests share and where the new test fits among them.

## 2. Write the test

### Self-contained

A test carries everything it needs. The setup, the action, the assertion, and the dependencies it uses are all visible inside the test body. Someone reading only the test knows what runs and what must be true.

```
describe "checkout"
  test "total equals item price when cart has one item"
    cart = Cart(items: [Item(sku: "A1", price: 10)])
    receipt = checkout(cart)
    expect receipt == Receipt(total: 10, itemCount: 1)
```

### Inline first

Every test builds its own data. Sample objects, constants, and fixtures live inside the test that uses them, even when five tests build the same object five times. Repetition is the price for no test being able to move another.

A helper may move to the nearest enclosing group when three things hold at once. It is identical across the tests, it is verbose, and giving it a name makes those tests easier to read. It starts inline and earns the move. The file top holds imports only.

### Deterministic

A test gives the same result on every run, on every machine, until the code under test changes. Two things break that.

Inputs the code reads from the outside. The clock, random values, environment variables. The test fixes every one of them inside its body, so nothing comes from wherever the test happens to run.

```
test "marks the invoice overdue when due date has passed"
  now = Date("2026-03-01")
  invoice = Invoice(dueDate: Date("2026-02-28"))
  expect isOverdue(invoice, now: now) == true
```

With now = Date.today() this test passes until the day it does not.

Order the code does not guarantee. When the result is a list with no fixed order, the assertion ignores order. Sort before comparing, or use the suite's unordered match.

```
test "returns every active user when two users are active"
  result = activeUsers()
  expect sorted(result, by: id) == [User(id: 1), User(id: 2)]
```

A plain == on the unsorted list passes on some runs and fails on others.

### Group by the code's structure

Group tests with the suite's grouping mechanism so they mirror the code. One group per module or function, nested when the code nests, so a failure reports the path to the behavior that broke.

```
describe "cart"
  describe "checkout"
    test "total equals item price when cart has one item"
  describe "addItem"
    test "increments quantity when the sku is already in the cart"
```

### Naming

The name reads outcome first, then the setup that produces it. The enclosing group already names the module or function, so the test name leaves that out. When a test fails, the suite prints the group and the name together, and that line alone says which behavior broke and under what condition.

```
describe "checkout"
  test "total equals item price when cart has one item"
  test "fails with EmptyCart when cart has no items"
  test "applies a coupon once when the same coupon is passed twice"
```

### One case per test

A test targets one case. When you find yourself writing "and" in the name, or a second unrelated assertion in the body, that is a second test.

```
test "total equals item price when cart has one item"
test "receipt lists one item when cart has one item"
```

### Table tests for variations

When one case has many input variations, write a table test. The body runs once per row, each row is its own test, and each row fails on its own.

```
describe "parseAmount"
  for each [input, expected] in
    ["10", 10]
    ["10.50", 10.5]
    ["1,000", 1000]
  test "returns {expected} when input is {input}"
    expect parseAmount(input) == expected
```

### Real over fake

Use the real implementation and real infrastructure. Anything that can run inside the test environment is cheap enough. Databases, caches, and brokers all start in a container next to the suite. Set up real data in them and run the real code path.

A stand-in, whether a mock, a fake, or a stub, replaces only what the project does not own and cannot run locally. A third-party API across the wire, a payment provider, an email gateway.

A stand-in's setup is test setup. What it returns, what it records, how it fails, all of it is declared inside the test that depends on it, and it follows the same rules as any other input.

```
test "marks the order paid when the payment provider accepts the charge"
  payments = stub PaymentProvider
    charge(amount: 10) returns Charge(id: "ch_1", status: "accepted")
  order = payOrder(Order(total: 10), payments: payments)
  expect order.status == "paid"
```

### Test our code, not the library

Third-party libraries and services are assumed to work. A test covers how our code uses them, and the assertion is on our result, never on the library's own behavior.

```
test "stores the hashed password when a user registers"
  user = register(email: "a@b.c", password: "secret")
  expect verifyHash("secret", user.passwordHash) == true
```

There is no test that verifyHash hashes correctly, that is the library's job.

### Assert the whole shape

Compare the full result against the full expected value, with strict equality or a partial match when only part of the shape matters. One assertion shows the whole picture, and a mismatch prints the whole diff.

```
receipt = checkout(cart)
expect receipt == Receipt(total: 10, itemCount: 1, currency: "EUR")
```

### Failures are specific

A test for a failure passes only on the exact error expected, so a different failure in the same spot still turns the test red. How specific the match has to be depends on the error. Some errors carry one reason and nothing else, and the type is the whole match. Others bundle many reasons under one type, and the match has to include the code or field that names the reason. Match on the message only when nothing else can tell the reasons apart. Messages are copy, and copy changes for reasons that have nothing to do with behavior.

```
test "fails with EmptyCart when cart has no items"
  expect checkout(Cart(items: [])) to fail with EmptyCart

test "fails with ValidationError code MISSING_SKU when an item has no sku"
  expect addItem(cart, Item(sku: "", price: 10))
    to fail with ValidationError(code: "MISSING_SKU")
```

Matching only ValidationError would also pass on a negative price.

## 3. Prove it turns red

This step covers each test you wrote or changed. A test you left as it was only needs to run green.

Break the condition the test guards, by running it before the code exists or by flipping the behavior under test, and run it. It fails, and it fails for the reason the name states. Restore the code and run it again. Done when you have seen both the red run and the green run for every test you wrote or changed.
