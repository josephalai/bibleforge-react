const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const books = require("../data/books");
const bible = require("../data/bible");
const { getDefinition } = require("../data/definitions");

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

  it("should return verses for Exodus 1 (full Bible embedded)", () => {
    const verses = bible.getVerses(2, 1);
    assert.ok(verses.length > 1);
    assert.ok(verses[0].text.includes("children of Israel"));
  });

  it("should return placeholder for invalid chapter", () => {
    const verses = bible.getVerses(1, 99); // Genesis only has 50 chapters
    assert.ok(verses.length > 0);
    assert.ok(verses[0].text.includes("Chapter not found"));
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

describe("definitions data", () => {
  it("should return definition for common biblical words", () => {
    const result = getDefinition("God");
    assert.ok(result);
    assert.equal(result.word, "god");
    assert.ok(result.definition.length > 0);
  });

  it("should return definition for archaic words", () => {
    const result = getDefinition("thee");
    assert.ok(result);
    assert.ok(result.definition.includes("You"));
  });

  it("should return definition for theological terms", () => {
    const result = getDefinition("salvation");
    assert.ok(result);
    assert.ok(result.definition.includes("Deliverance"));
  });

  it("should handle suffix matching for -eth verbs", () => {
    const result = getDefinition("blesseth");
    assert.ok(result);
    assert.equal(result.word, "blesseth");
  });

  it("should handle plural words via -s matching", () => {
    const result = getDefinition("prophets");
    assert.ok(result);
    assert.equal(result.word, "prophets");
  });

  it("should return null for unknown words", () => {
    const result = getDefinition("xyznonexistent");
    assert.equal(result, null);
  });

  it("should strip punctuation from input", () => {
    const result = getDefinition("God,");
    assert.ok(result);
    assert.equal(result.word, "god");
  });

  it("should return concordance data with Strong's number for 'plains'", () => {
    const result = getDefinition("plains");
    assert.ok(result);
    assert.ok(result.concordance, "Should have concordance data");
    assert.equal(result.concordance.strongsNumber, "H6160");
    assert.equal(result.concordance.language, "Hebrew");
    assert.ok(result.concordance.originalWord.length > 0);
    assert.ok(result.concordance.pronunciation.length > 0);
    assert.ok(result.concordance.shortDefinition.length > 0);
    assert.ok(result.concordance.detailedDefinition.length > 0);
  });

  it("should include root form in concordance when available", () => {
    const result = getDefinition("plains");
    assert.ok(result.concordance.rootForm, "Should have root form");
    assert.equal(result.concordance.rootForm.strongsNumber, "H6150");
    assert.ok(result.concordance.rootForm.originalWord.length > 0);
    assert.ok(result.concordance.rootForm.pronunciation.length > 0);
  });

  it("should return concordance for Greek NT words", () => {
    const result = getDefinition("love");
    assert.ok(result);
    assert.ok(result.concordance, "Should have concordance data");
    assert.equal(result.concordance.strongsNumber, "G25");
    assert.equal(result.concordance.language, "Greek");
  });

  it("should return concordance for words with direct Strong's mapping", () => {
    const result = getDefinition("blesseth");
    assert.ok(result);
    assert.ok(result.concordance, "blesseth should have concordance data");
    assert.equal(result.concordance.strongsNumber, "H1288");
  });

  it("should still return plain definition for words without Strong's mapping", () => {
    const result = getDefinition("hallelujah");
    assert.ok(result);
    assert.ok(result.definition.length > 0);
    // 'hallelujah' has no Strong's mapping in the word map
    assert.equal(result.concordance, undefined);
  });
});
