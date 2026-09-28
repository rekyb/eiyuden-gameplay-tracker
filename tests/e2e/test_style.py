"""Tests verifying CSS coverage and styling requirements."""

from pathlib import Path
import re
import unittest

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class TestStyleCSS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        html_path = PROJECT_ROOT / "static" / "index.html"
        css_path = PROJECT_ROOT / "static" / "style.css"
        with open(html_path, "r", encoding="utf-8") as f:
            cls.html = f.read()
        with open(css_path, "r", encoding="utf-8") as f:
            cls.css = f.read()

    def test_css_file_exists_and_non_empty(self):
        self.assertGreater(len(self.css), 1000, "CSS file should have comprehensive rules")

    def test_html_classes_covered_in_css(self):
        # Extract all class names from HTML
        class_matches = re.findall(r'class=["\']([^"\']+)["\']', self.html)
        individual_classes = set()
        for group in class_matches:
            for cls_name in group.split():
                individual_classes.add(cls_name)

        missing = []
        for c in sorted(individual_classes):
            pattern = rf'(\.{re.escape(c)}[\s,\.:\[\{{>])'
            if not re.search(pattern, self.css):
                missing.append(c)

        self.assertEqual(missing, [], f"Classes missing in static/style.css: {missing}")

    def test_critical_dynamic_classes_present(self):
        """Classes generated dynamically by static/app.js must also be styled."""
        dynamic_classes = [
            'status-recruited',
            'status-missing',
            'badge-missable',
            'role-badge',
            'role-battle',
            'role-support',
            'role-attendant',
            'toast',
            'toast-success',
            'toast-error',
            'toast-info',
            'toast-leaving',
            'hero-name',
        ]
        for c in dynamic_classes:
            pattern = rf'(\.{re.escape(c)}[\s,\.:\[\{{>])'
            self.assertTrue(re.search(pattern, self.css), f"Dynamic class missing: {c}")

    def test_key_selectors_and_properties(self):
        # Check sticky table header
        self.assertIn('position: sticky', self.css)
        self.assertIn('top: 0', self.css)

        # Check system font stack
        self.assertIn('-apple-system', self.css)
        self.assertIn('BlinkMacSystemFont', self.css)

        # Check native dialog and backdrop styling
        self.assertIn('::backdrop', self.css)
        self.assertIn('.config-dialog', self.css)

        # Check toast container
        self.assertIn('.toast-container', self.css)

        # Check responsive media query
        self.assertIn('@media', self.css)

    def test_recipes_and_navigation_classes_present(self):
        """Classes for navigation, recipe categories, and footer must be styled."""
        required = [
            'top-nav',
            'nav-tab',
            'recipes-hint',
            'recipe-cat-appetizer',
            'recipe-cat-main',
            'recipe-cat-dessert',
            'col-recipe-cooked',
            'cooked-checkbox',
            'app-footer',
            'footer-link',
        ]
        for c in required:
            pattern = rf'(\.{re.escape(c)}[\s,\.\:\[\{{\>])'
            self.assertTrue(re.search(pattern, self.css), f"Required class missing in style.css: {c}")

    def test_beigoma_and_trainers_classes_present(self):
        """Classes for beigoma subnavigation, columns, and status badges must be styled."""
        required = [
            'subnav-tabs',
            'subnav-tab',
            'subnav-wrapper',
            'subview-panel',
            'beigoma-table',
            'trainer-table',
            'col-beigoma-name',
            'col-beigoma-location',
            'col-beigoma-status',
            'col-trainer-name',
            'col-trainer-location',
            'col-trainer-status',
            'badge-obtained',
            'badge-defeated',
            'badge-missing',
            'badge-not-battled',
        ]
        for c in required:
            pattern = rf'(\.{re.escape(c)}[\s,\.\:\[\{{\>])'
            self.assertTrue(re.search(pattern, self.css), f"Required beigoma class missing in style.css: {c}")

    def test_pagination_styles_defined(self):
        css_path = Path(__file__).resolve().parent.parent.parent / "static" / "style.css"
        css = css_path.read_text(encoding="utf-8")
        self.assertIn('.pagination-bar', css)
        self.assertIn('.pagination-info', css)
        self.assertIn('.pagination-controls', css)
        self.assertIn('.page-btn', css)
        self.assertIn('.page-btn.active', css)


if __name__ == '__main__':
    unittest.main()

