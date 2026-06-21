"""
Parser Module
=============
Handles reading and parsing subject README guides in the dsai-gate and cse-gate
repositories, extracting resource links (books, courses, notes, practice problems)
and mapping them dynamically into structured syllabus objects.
"""

import os
import re
from typing import List, Dict

# Define paths relative to the project root directory
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DSAI_GATE_DIR = os.path.join(BASE_DIR, "dsai-gate")
CSE_GATE_DIR = os.path.join(BASE_DIR, "cse-gate")

# Predefined curriculum catalogs containing subject definitions
from src.curriculum import CS_SUBJECTS, DSAI_SUBJECT_META

def parse_readme_resources(readme_path: str) -> List[Dict]:
    """
    Parses resource links grouped under header sections from a subject's Markdown README guide.
    Used for the dsai-gate repository file structures.
    
    Args:
        readme_path: The absolute file path to the README.md to parse.
        
    Returns:
        A list of parsed section dictionaries, e.g.:
        [
            {
                "title": "Books",
                "count": 2,
                "resources": [{"title": "Intro to Stats", "url": "https://..."}]
            }
        ]
    """
    if not os.path.exists(readme_path):
        return []
    
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    sections = []
    current_section = None
    section_items = []
    
    # Regular expression to extract title and destination URL from Markdown links
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    for line in content.splitlines():
        line_stripped = line.strip()
        
        # Check if line is a Markdown heading level 2 (##)
        if line_stripped.startswith("##"):
            # Save accumulated items for the previous section before starting a new one
            if current_section and section_items:
                sections.append({
                    "title": current_section,
                    "count": len(section_items),
                    "resources": section_items
                })
            
            # Clean anchor tags and hashes from the heading text
            header_text = re.sub(r'^#+\s*(?:<a name="[^"]+"></a>)?', '', line_stripped).strip()
            header_lower = header_text.lower()
            
            # Standardize section naming conventions
            if "book" in header_lower:
                current_section = "Books"
            elif "course" in header_lower or "nptel" in header_lower or "mooc" in header_lower:
                current_section = "Courses"
            elif "note" in header_lower:
                current_section = "Notes"
            elif "article" in header_lower:
                current_section = "Articles"
            elif "practice" in header_lower or "problem" in header_lower:
                current_section = "Practice"
            else:
                current_section = header_text
                
            section_items = []
            
        # Parse bullet points representing resource links
        elif line_stripped.startswith(("*", "-")) and current_section:
            match = link_pattern.search(line_stripped)
            if match:
                title = match.group(1).strip(' *"`')
                url = match.group(2).strip()
                title = re.sub(r'\*\*|\*|`|"', '', title).strip()
                
                # Resolve relative path URLs to absolute GitHub links
                if url.startswith("/"):
                    url = f"https://github.com/Kunaldargan/dsai-gate/blob/main{url}"
                elif not url.startswith("http"):
                    url = f"https://github.com/Kunaldargan/dsai-gate/blob/main/dsai-gate/{url}"
                    
                section_items.append({
                    "title": title[:60] + "..." if len(title) > 63 else title,
                    "url": url
                })
                
    # Append the last parsed section
    if current_section and section_items:
        sections.append({
            "title": current_section,
            "count": len(section_items),
            "resources": section_items
        })
        
    return sections


def get_curriculum_data_da() -> List[Dict]:
    """
    Parses the main index table in the dsai-gate README.md file and generates
    detailed syllabus topic guides for the Data Science & AI stream.
    
    Returns:
        A list of subject dictionaries with nested lists of topics and resource sections.
    """
    readme_path = os.path.join(DSAI_GATE_DIR, "README.md")
    if not os.path.exists(readme_path):
        return []
        
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Pattern matching cells in the main subject table
    subject_pattern = re.compile(
        r'<td><h3 id="(?P<id>[^"]+)"><a href="(?P<guide>[^"]+)">\s*(?P<title>[^<]+)</h3></td>\s*<td>(?P<topics_text>.*?)</td>',
        re.DOTALL | re.IGNORECASE
    )
    
    subjects_list = []
    
    for match in subject_pattern.finditer(content):
        sub_id = match.group("id")
        guide = match.group("guide")
        title = match.group("title").strip()
        topics_text = match.group("topics_text")
        
        # Extract individual topic list items from the table cell
        topics = []
        for line in topics_text.splitlines():
            line_s = line.strip()
            if line_s.startswith(("*", "-")):
                topic = re.sub(r'^[\*\-\s]+', '', line_s).strip()
                topic = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', topic)
                if topic:
                    topics.append(topic)
                    
        # Retrieve subject-specific metadata (color accent, notebook path)
        meta = DSAI_SUBJECT_META.get(sub_id, {
            "number": "00",
            "short": sub_id[:10],
            "accent": "#635bff",
            "notebook": ""
        })
        
        # Parse sub-resource links from individual sub-readme files
        subject_readme_path = os.path.join(DSAI_GATE_DIR, guide)
        sections = parse_readme_resources(subject_readme_path)
        
        # Supply a human-readable summary description
        description = f"Core preparation guide for {title}."
        if sub_id == "probability-and-statistics":
            description = "Probability fundamentals, counting methods, and hypothesis testing."
        elif sub_id == "linear-algebra":
            description = "Vector spaces, matrices, eigenvalues, SVD, and quadratic forms."
        elif sub_id == "calculus-and-optimization":
            description = "Single-variable functions, limits, continuity, Taylor series, and optimization."
        elif sub_id == "programming-and-algorithms":
            description = "Python programming, basic data structures, search/sort, and graph traversals."
        elif sub_id == "database-management":
            description = "ER-models, relational algebra, SQL, normal forms, and data warehousing."
        elif sub_id == "machine-learning":
            description = "Supervised regression/classification, MLP, and unsupervised clustering/PCA."
        elif sub_id == "AI":
            description = "Informed/uninformed search, adversarial search, logic, and probabilistic reasoning."
            
        subjects_list.append({
            "id": sub_id,
            "number": meta["number"],
            "short": meta["short"],
            "title": title,
            "description": description,
            "accent": meta["accent"],
            "guide": f"https://github.com/Kunaldargan/dsai-gate/blob/main/dsai-gate/{guide}",
            "notebook": meta["notebook"],
            "topics": topics,
            "sections": sections
        })
        
    return sorted(subjects_list, key=lambda x: x["number"])


def parse_cse_readme_resources(readme_path: str) -> Dict[str, List[Dict]]:
    """
    Parses compiled resources by subject header in the master cse-gate README.md file.
    
    Args:
        readme_path: Absolute file path to the cse-gate master README.md file.
        
    Returns:
        A dictionary mapping subject IDs to lists of resource sections.
    """
    if not os.path.exists(readme_path):
        return {}
        
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    subject_resources = {}
    current_subject = None
    section_items = []
    current_section_type = "Resources"
    
    # HTML link matching pattern
    a_tag_pattern = re.compile(r'<a href="(?P<url>[^"]+)"[^>]*>(?P<title>[^<]+)</a>', re.IGNORECASE)
    # Markdown link matching pattern
    markdown_link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    for line in content.splitlines():
        line_stripped = line.strip()
        
        # Check if line is a top-level subject header (single hash #)
        if line_stripped.startswith("#") and not line_stripped.startswith("##"):
            if current_subject and section_items:
                if current_subject not in subject_resources:
                    subject_resources[current_subject] = []
                subject_resources[current_subject].append({
                    "title": current_section_type,
                    "count": len(section_items),
                    "resources": section_items
                })
            
            header_text = re.sub(r'^#+\s*', '', line_stripped).strip()
            header_lower = header_text.lower()
            
            # Map header strings to standard CS subject IDs
            if "computation" in header_lower or "toc" in header_lower:
                current_subject = "theory-of-computation"
            elif "operating" in header_lower or "os" in header_lower:
                current_subject = "operating-system"
            elif "c programming" in header_lower or "data structure" in header_lower:
                current_subject = "programming-and-data-structures"
            elif "digital" in header_lower:
                current_subject = "digital-logic"
            elif "dbms" in header_lower:
                current_subject = "databases"
            elif "compiler" in header_lower:
                current_subject = "compiler-design"
            elif "architecture" in header_lower or "co notes" in header_lower or "coa" in header_lower:
                current_subject = "computer-organization"
            elif "network" in header_lower:
                current_subject = "computer-networks"
            elif "algorithm" in header_lower:
                current_subject = "algorithms"
            else:
                current_subject = None
                
            section_items = []
            current_section_type = "Resources"
            
        elif current_subject:
            # Check for sub-headings representing section classifications
            if line_stripped.startswith("**") and line_stripped.endswith("**"):
                if section_items:
                    if current_subject not in subject_resources:
                        subject_resources[current_subject] = []
                    subject_resources[current_subject].append({
                        "title": current_section_type,
                        "count": len(section_items),
                        "resources": section_items
                    })
                    section_items = []
                current_section_type = line_stripped.strip("*")
                
            # Parse links inside lists or ordered numbers
            elif line_stripped and (line_stripped[0].isdigit() or line_stripped.startswith(("*", "-"))):
                a_match = a_tag_pattern.search(line_stripped)
                md_match = markdown_link_pattern.search(line_stripped)
                
                title = None
                url = None
                
                if a_match:
                    url = a_match.group("url")
                    title = a_match.group("title").strip()
                elif md_match:
                    title = md_match.group(1).strip()
                    url = md_match.group(2).strip()
                    
                if title and url:
                    title = re.sub(r'\*\*|\*|`|"', '', title).strip()
                    if url.startswith("/"):
                        url = f"https://github.com/baquer/GATE-and-CSE-Resources-for-Students/blob/master{url}"
                    section_items.append({
                        "title": title[:60] + "..." if len(title) > 63 else title,
                        "url": url
                    })
                    
    # Save resources for the final subject
    if current_subject and section_items:
        if current_subject not in subject_resources:
            subject_resources[current_subject] = []
        subject_resources[current_subject].append({
            "title": current_section_type,
            "count": len(section_items),
            "resources": section_items
        })
        
    return subject_resources


def get_curriculum_data_cs() -> List[Dict]:
    """
    Loads dynamic resource links from the local cse-gate guide repository README.md
    and binds them into the standard CS syllabus metadata schema.
    
    Returns:
        A list of subject dictionaries mapping out the entire Computer Science stream.
    """
    readme_path = os.path.join(CSE_GATE_DIR, "README.md")
    resources_by_subject = parse_cse_readme_resources(readme_path)
    
    subjects_list = []
    for sub in CS_SUBJECTS:
        sub_data = dict(sub)
        sub_id = sub_data["id"]
        
        # Populate resources parsed dynamically from the README
        sub_data["sections"] = resources_by_subject.get(sub_id, [])
        sub_data["guide"] = f"https://github.com/baquer/GATE-and-CSE-Resources-for-Students/blob/master/README.md#{sub_id}"
        
        subjects_list.append(sub_data)
        
    return subjects_list
