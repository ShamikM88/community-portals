import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUERY_SYNTAX_LINE = re.compile(r"^Query syntax:\s*\S", re.MULTILINE)


class PortalSkillTests(unittest.TestCase):
    def test_every_portal_skill_states_its_query_syntax(self):
        skills = sorted(ROOT.glob("portals/*/*-search/SKILL.md"))
        self.assertTrue(skills, "no portal skills found")
        missing = [
            path.relative_to(ROOT).as_posix()
            for path in skills
            if not QUERY_SYNTAX_LINE.search(path.read_text(encoding="utf-8"))
        ]
        self.assertEqual(
            [],
            missing,
            "portal SKILL.md files without a `Query syntax:` line (/scrape follows it for quoting): "
            + ", ".join(missing),
        )


if __name__ == "__main__":
    unittest.main()
