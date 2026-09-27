import re
import unittest

class TestStyleCSS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open('static/index.html', 'r', encoding='utf-8') as f:
            cls.html = f.read()
        with open('static/style.css', 'r', encoding='utf-8') as f:
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

if __name__ == '__main__':
    unittest.main()
