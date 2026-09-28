import unittest
from pathlib import Path


class TestPaginationDom(unittest.TestCase):
    def setUp(self):
        index_path = Path(__file__).resolve().parent.parent.parent / "static" / "index.html"
        self.html = index_path.read_text(encoding="utf-8")

    def test_pagination_containers_exist(self):
        self.assertIn('id="heroes-pagination"', self.html)
        self.assertIn('id="recipes-pagination"', self.html)
        self.assertIn('id="beigoma-pagination"', self.html)
        self.assertIn('id="trainer-pagination"', self.html)

    def test_pagination_aria_and_classes(self):
        self.assertIn('class="pagination-bar"', self.html)
        self.assertIn('aria-label="Heroes pagination"', self.html)
        self.assertIn('aria-label="Recipes pagination"', self.html)
        self.assertIn('aria-label="Beigoma collection pagination"', self.html)
        self.assertIn('aria-label="Beigoma trainers pagination"', self.html)


if __name__ == "__main__":
    unittest.main()
