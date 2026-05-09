import sys


def main() -> None:
    # Reads an HTTP response capture (headers + blank line + body) from a file path argument
    # and prints the body to stdout unchanged.
    path = sys.argv[1]
    raw = open(path, "r", encoding="utf-8", errors="ignore").read()

    # Some evidence files prepend a "COMMAND:" line; trim to the first HTTP status line if present.
    http_idx = raw.find("HTTP/")
    if http_idx != -1:
        raw = raw[http_idx:]

    if "\r\n\r\n" in raw:
        body = raw.split("\r\n\r\n", 1)[1]
    elif "\n\n" in raw:
        body = raw.split("\n\n", 1)[1]
    else:
        body = raw

    sys.stdout.write(body)


if __name__ == "__main__":
    main()
