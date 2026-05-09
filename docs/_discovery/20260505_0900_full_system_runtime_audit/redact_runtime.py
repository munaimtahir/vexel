import re
import sys


def main() -> None:
    s = sys.stdin.read()

    s = re.sub(r'("accessToken"\s*:\s*")([^"]+)(")', r"\1<REDACTED_ACCESS_TOKEN>\3", s)
    s = re.sub(r'("refreshToken"\s*:\s*")([^"]+)(")', r"\1<REDACTED_REFRESH_TOKEN>\3", s)
    s = re.sub(r"(set-cookie:\s*vexel_refresh=)([^;\r\n]+)", r"\1<REDACTED_COOKIE>", s, flags=re.I)

    sys.stdout.write(s)


if __name__ == "__main__":
    main()

