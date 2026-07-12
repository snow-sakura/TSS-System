"""Report generator tool for creating test reports"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from core.config import settings
from core.models import TestResult, TestStatus, TestSuite


class ReportGeneratorTool:
    """Tool for generating test reports"""
    
    def __init__(self):
        self.reports_dir = settings.reports_dir
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_summary_report(self, results: List[TestResult]) -> Dict[str, Any]:
        """Generate a summary report from test results"""
        total = len(results)
        passed = sum(1 for r in results if r.status == TestStatus.PASSED)
        failed = sum(1 for r in results if r.status == TestStatus.FAILED)
        skipped = sum(1 for r in results if r.status == TestStatus.SKIPPED)
        errors = sum(1 for r in results if r.status == TestStatus.ERROR)
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "errors": errors,
                "pass_rate": f"{(passed / total * 100):.2f}%" if total > 0 else "0%"
            },
            "failed_tests": [
                {
                    "name": r.name,
                    "type": r.type.value,
                    "message": r.message,
                    "duration": r.duration
                }
                for r in results if r.status == TestStatus.FAILED
            ],
            "error_tests": [
                {
                    "name": r.name,
                    "type": r.type.value,
                    "message": r.message,
                    "traceback": r.traceback
                }
                for r in results if r.status == TestStatus.ERROR
            ]
        }
        
        return report
    
    def save_report(self, report: Dict[str, Any], filename: str = None) -> str:
        """Save report to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"test_report_{timestamp}.json"
        
        filepath = self.reports_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return str(filepath)
    
    def generate_html_report(self, results: List[TestResult]) -> str:
        """Generate HTML report"""
        summary = self.generate_summary_report(results)
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>TSS Test Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .summary {{ background: #f5f5f5; padding: 20px; border-radius: 5px; }}
        .passed {{ color: green; }}
        .failed {{ color: red; }}
        .skipped {{ color: orange; }}
        table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background: #f2f2f2; }}
    </style>
</head>
<body>
    <h1>TSS Test Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total: {summary['summary']['total']}</p>
        <p class="passed">Passed: {summary['summary']['passed']}</p>
        <p class="failed">Failed: {summary['summary']['failed']}</p>
        <p class="skipped">Skipped: {summary['summary']['skipped']}</p>
        <p>Pass Rate: {summary['summary']['pass_rate']}</p>
    </div>
    <h2>Test Results</h2>
    <table>
        <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Message</th>
        </tr>
"""
        
        for result in results:
            status_class = result.status.value
            html += f"""        <tr>
            <td>{result.name}</td>
            <td>{result.type.value}</td>
            <td class="{status_class}">{result.status.value}</td>
            <td>{result.duration:.2f}s</td>
            <td>{result.message or ''}</td>
        </tr>
"""
        
        html += """    </table>
</body>
</html>"""
        
        return html
    
    def save_html_report(self, results: List[TestResult], filename: str = None) -> str:
        """Save HTML report to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"test_report_{timestamp}.html"
        
        html = self.generate_html_report(results)
        filepath = self.reports_dir / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        
        return str(filepath)


# Tool instance
report_generator_tool = ReportGeneratorTool()
