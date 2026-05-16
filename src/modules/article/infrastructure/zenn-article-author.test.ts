import { describe, expect, it } from "vite-plus/test";

import { formatArticleAuthorLine } from "../domain/article-author";
import {
  extractZennArticleAuthorFromCanonicalUrl,
  extractZennArticleAuthorFromHtml,
  resolveZennArticleAuthor,
} from "./zenn-article-author";

describe("extractZennArticleAuthorFromCanonicalUrl に関するテスト", () => {
  it("Zenn 記事 URL から username を取り出す", () => {
    // Arrange
    const canonicalUrl = "https://zenn.dev/neet/articles/031d5499e68685";

    // Act
    const actual = extractZennArticleAuthorFromCanonicalUrl(canonicalUrl);

    // Assert
    expect(actual).toEqual({ username: "neet" });
  });

  it("Zenn 記事 URL 以外のとき、null を返す", () => {
    // Arrange
    const canonicalUrl = "https://example.com/articles/sample";

    // Act
    const actual = extractZennArticleAuthorFromCanonicalUrl(canonicalUrl);

    // Assert
    expect(actual).toBeNull();
  });
});

describe("extractZennArticleAuthorFromHtml に関するテスト", () => {
  it("__NEXT_DATA__ から表示名と Publication 名を取り出す", () => {
    // Arrange
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          user: { username: "neet", name: "Ryō Igarashi" },
          publication: { name: "Gemcook Tech Blog" },
        },
      },
    })}</script>`;

    // Act
    const actual = extractZennArticleAuthorFromHtml(html);

    // Assert
    expect(actual).toEqual({
      displayName: "Ryō Igarashi",
      publicationName: "Gemcook Tech Blog",
    });
  });
});

describe("resolveZennArticleAuthor に関するテスト", () => {
  it("URL と HTML をマージして著者情報を返す", () => {
    // Arrange
    const canonicalUrl = "https://zenn.dev/neet/articles/031d5499e68685";
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          user: { username: "neet", name: "Ryō Igarashi" },
          publication: null,
        },
      },
    })}</script>`;

    // Act
    const actual = resolveZennArticleAuthor(canonicalUrl, html);

    // Assert
    expect(actual).toEqual({
      username: "neet",
      displayName: "Ryō Igarashi",
      publicationName: null,
    });
  });
});

describe("formatArticleAuthorLine に関するテスト", () => {
  it("表示名があるとき、控えめな著者行を返す", () => {
    // Arrange
    const author = {
      username: "neet",
      displayName: "Ryō Igarashi",
      publicationName: "Gemcook Tech Blog",
    };

    // Act
    const actual = formatArticleAuthorLine(author);

    // Assert
    expect(actual).toBe("_著者:_ Ryō Igarashi · Gemcook Tech Blog (@neet)");
  });
});
