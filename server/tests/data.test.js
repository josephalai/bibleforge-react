const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const books = require("../data/books");
const bible = require("../data/bible");

describe("books data", () => {
  it("should have 66 books (plus null at index 0)", () => {
    assert.equal(books.length, 67);
    assert.equal(books[0], null);
  });

  it("should have correct first and last books", () => {
    assert.equal(books[1].name, "Genesis");
    assert.equal(books[1].chapters, 50);
    assert.equal(books[66].name, "Revelation");
    assert.equal(books[66].chapters, 22);
  });

  it("every book should have required fields", () => {
    books.filter(Boolean).forEach((book) => {
      assert.ok(book.id, `Book missing id`);
      assert.ok(book.name, `Book ${book.id} missing name`);
      assert.ok(book.shortName, `Book ${book.id} missing shortName`);
      assert.ok(book.chapters > 0, `Book ${book.id} has invalid chapter count`);
      assert.ok(
        book.testament === "OT" || book.testament === "NT",
        `Book ${book.id} has invalid testament`
      );
    });
  });
});

describe("bible verse data", () => {
  it("should return 31 verses for Genesis 1", () => {
    const verses = bible.getVerses(1, 1);
    assert.equal(verses.length, 31);
  });

  it("should return correct first verse of Genesis", () => {
    const verses = bible.getVerses(1, 1);
    assert.equal(verses[0].book, 1);
    assert.equal(verses[0].chapter, 1);
    assert.equal(verses[0].verse, 1);
    assert.ok(verses[0].text.includes("In the beginning"));
  });

  it("should use BBCCCVVV format for verse IDs", () => {
    const verses = bible.getVerses(1, 1);
    assert.equal(verses[0].id, 1001001); // book 1, chapter 1, verse 1
    assert.equal(verses[30].id, 1001031); // book 1, chapter 1, verse 31
  });

  it("should return verses for John 1", () => {
    const verses = bible.getVerses(43, 1);
    assert.ok(verses.length > 0);
    assert.ok(verses[0].text.includes("In the beginning was the Word"));
  });

  it("should return placeholder for unavailable chapters", () => {
    const verses = bible.getVerses(2, 1); // Exodus 1 (not embedded)
    assert.ok(verses.length > 0);
    assert.ok(
      verses[0].text.includes("Full Bible text") ||
        verses[0].text.includes("Docker")
    );
  });

  it("should search verses by keyword", () => {
    const results = bible.searchVerses("beginning");
    assert.ok(results.length > 0);
    results.forEach((v) => {
      assert.ok(
        v.text.toLowerCase().includes("beginning"),
        `Verse ${v.id} does not contain 'beginning'`
      );
    });
  });

  it("should return empty array for unmatched search", () => {
    const results = bible.searchVerses("xyznonexistent");
    assert.equal(results.length, 0);
  });
});
