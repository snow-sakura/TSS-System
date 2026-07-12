"""Initialize knowledge base from markdown files"""

import json
import re
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from knowledge.vector_store import knowledge_store


def parse_markdown_sections(content: str) -> list:
    """Parse markdown file into sections"""
    sections = []
    current_section = None
    current_content = []
    
    for line in content.split('\n'):
        if line.startswith('## '):
            if current_section:
                sections.append({
                    'title': current_section,
                    'content': '\n'.join(current_content).strip()
                })
            current_section = line[3:].strip()
            current_content = []
        elif line.startswith('### '):
            if current_content:
                current_content.append('')
            current_content.append(line)
        else:
            current_content.append(line)
    
    if current_section:
        sections.append({
            'title': current_section,
            'content': '\n'.join(current_content).strip()
        })
    
    return sections


def load_test_patterns():
    """Load test patterns from markdown files"""
    patterns_dir = project_root / "knowledge" / "test_patterns"
    
    for md_file in patterns_dir.glob("*.md"):
        print(f"Loading patterns from {md_file.name}...")
        
        content = md_file.read_text(encoding='utf-8')
        sections = parse_markdown_sections(content)
        
        pattern_id = 1
        for section in sections:
            # Extract individual patterns from section content
            lines = section['content'].split('\n')
            current_pattern = []
            pattern_title = None
            
            for line in lines:
                if line.startswith('### 模式：'):
                    if current_pattern and pattern_title:
                        # Save previous pattern
                        pattern_content = '\n'.join(current_pattern).strip()
                        if pattern_content:
                            knowledge_store.add_test_pattern({
                                "id": f"pattern-{md_file.stem}-{pattern_id:03d}",
                                "description": f"{pattern_title}: {pattern_content[:200]}",
                                "metadata": {
                                    "category": section['title'],
                                    "source": md_file.name,
                                    "type": "api"
                                }
                            })
                            pattern_id += 1
                    pattern_title = line[6:].strip()
                    current_pattern = []
                elif line.startswith('**测试示例：**'):
                    # Skip code examples for now
                    continue
                elif line.startswith('```'):
                    # Skip code blocks
                    continue
                else:
                    current_pattern.append(line)
            
            # Save last pattern in section
            if current_pattern and pattern_title:
                pattern_content = '\n'.join(current_pattern).strip()
                if pattern_content and not pattern_content.startswith('```'):
                    knowledge_store.add_test_pattern({
                        "id": f"pattern-{md_file.stem}-{pattern_id:03d}",
                        "description": f"{pattern_title}: {pattern_content[:200]}",
                        "metadata": {
                            "category": section['title'],
                            "source": md_file.name,
                            "type": "api"
                        }
                    })
                    pattern_id += 1


def load_bug_knowledge():
    """Load bug knowledge from JSON file"""
    bug_file = project_root / "knowledge" / "bug_knowledge" / "known_bugs.json"
    
    if bug_file.exists():
        print(f"Loading bug knowledge from {bug_file.name}...")
        data = json.loads(bug_file.read_text(encoding='utf-8'))
        
        for bug in data.get('bugs', []):
            knowledge_store.add_bug_knowledge({
                "id": bug['id'],
                "description": f"{bug['title']}: {bug['description']}",
                "metadata": {
                    "severity": bug.get('severity', 'unknown'),
                    "category": bug.get('category', 'unknown'),
                    "symptoms": bug.get('symptoms', []),
                    "root_cause": bug.get('root_cause', ''),
                    "fix_suggestion": bug.get('fix_suggestion', '')
                }
            })
            print(f"  Added bug: {bug['id']}")


def main():
    """Main function to initialize knowledge base"""
    print("=" * 60)
    print("TSS Paper Test - Knowledge Base Initialization")
    print("=" * 60)
    
    print("\n1. Loading test patterns...")
    load_test_patterns()
    
    print("\n2. Loading bug knowledge...")
    load_bug_knowledge()
    
    print("\n3. Checking knowledge base stats...")
    stats = knowledge_store.get_stats()
    print(f"  Test Patterns: {stats['test_patterns']}")
    print(f"  Bug Knowledge: {stats['bug_knowledge']}")
    print(f"  Test Results: {stats['test_results']}")
    
    print("\n" + "=" * 60)
    print("Knowledge base initialization complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
