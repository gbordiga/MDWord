import { describe, expect, it } from "vitest";
import { updateErrorReason, updateReady } from "./updates";

function failure(code: string, message = ""): Error {
  return Object.assign(new Error(message), { code });
}

describe("updateErrorReason", () => {
  it("extracts an HTTP status", () => {
    expect(updateErrorReason(failure("ERR_UPDATER_HTTP_ERROR", "HttpError: 403 Forbidden"))).toBe("HTTP 403");
    expect(updateErrorReason(failure("ERR_UPDATER_HTTP_ERROR", "statusCode: 503"))).toBe("HTTP 503");
    expect(updateErrorReason(failure("ERR_UPDATER_HTTP_ERROR"))).toBe("server error");
    // electron-updater's real shape for a 404 response:
    expect(
      updateErrorReason(failure("HTTP_ERROR_404", '404 "method: GET url: https://github.com/o/r/releases.atom"'))
    ).toBe("HTTP 404");
    expect(updateErrorReason(Object.assign(new Error("boom"), { name: "HttpError", code: "HTTP_ERROR_500" }))).toBe(
      "HTTP 500"
    );
  });

  it("names missing or unreadable release metadata", () => {
    expect(updateErrorReason(failure("ERR_UPDATER_LATEST_VERSION_NOT_FOUND"))).toBe(
      "release metadata missing"
    );
    expect(
      updateErrorReason(failure("ERR_UPDATER_CHANNEL_FILE_NOT_FOUND", "Cannot find latest.yml"))
    ).toBe("release metadata missing");
    expect(updateErrorReason(failure("ERR_UPDATER_INVALID_RELEASE_FEED", "Cannot parse releases feed"))).toBe(
      "release feed unreadable"
    );
  });

  it("names network and certificate failures", () => {
    expect(updateErrorReason(new Error("getaddrinfo ENOTFOUND github.com"))).toBe("DNS lookup failed");
    expect(updateErrorReason(new Error("net::ERR_INTERNET_DISCONNECTED"))).toBe("network unavailable");
    expect(updateErrorReason(new Error("net::ERR_CERT_AUTHORITY_INVALID"))).toBe("certificate rejected");
  });

  it("falls back to a readable code and then to an empty reason", () => {
    expect(updateErrorReason(failure("ERR_UPDATER_SOMETHING_ODD"))).toBe("something odd");
    expect(updateErrorReason(new Error("plain"))).toBe("");
    expect(updateErrorReason(undefined)).toBe("");
  });
});

describe("updateReady", () => {
  it("is true only when the update is downloaded", () => {
    expect(updateReady({ state: "downloaded", version: "1.0.0" })).toBe(true);
    expect(updateReady({ state: "downloading", version: "1.0.0", percent: 40 })).toBe(false);
    expect(updateReady(null)).toBe(false);
  });
});
