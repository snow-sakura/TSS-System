"""Analysis Crew - Coordinates analysis and review agents"""

from typing import Any, Dict, List

from agents.analyzer import analyzer_agent
from agents.reviewer import reviewer_agent
from knowledge.vector_store import knowledge_store


class AnalysisCrew:
    """Crew responsible for analyzing test results"""
    
    def __init__(self):
        self.analyzer = analyzer_agent
        self.reviewer = reviewer_agent
    
    def execute(self, test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the analysis workflow"""
        print("Analysis Crew: Starting execution...")
        
        # Phase 1: Analyze results
        print("  Phase 1: Analyzing test results...")
        analysis = self.analyzer.analyze_results(test_results)
        
        # Phase 2: Identify patterns
        print("  Phase 2: Identifying patterns...")
        patterns = self.analyzer._identify_patterns(test_results)
        analysis["patterns"] = patterns
        
        # Phase 3: Search for related knowledge
        print("  Phase 3: Searching knowledge base...")
        related_knowledge = self._search_related_knowledge(analysis)
        analysis["related_knowledge"] = related_knowledge
        
        # Phase 4: Generate recommendations
        print("  Phase 4: Generating recommendations...")
        recommendations = self._generate_detailed_recommendations(analysis)
        analysis["detailed_recommendations"] = recommendations
        
        # Generate report
        report = self.analyzer.generate_analysis_report(analysis)
        
        result = {
            "analysis": analysis,
            "report": report,
            "summary": self._generate_summary(analysis)
        }
        
        print("Analysis Crew: Execution complete!")
        return result
    
    def _search_related_knowledge(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Search for related knowledge in the knowledge base"""
        related = {
            "similar_patterns": [],
            "related_bugs": [],
            "historical_results": []
        }
        
        # Search for patterns based on issues
        issues = analysis.get("issues", [])
        for issue in issues:
            issue_type = issue.get("type", "")
            
            # Search patterns
            patterns = knowledge_store.search_test_patterns(issue_type, n_results=2)
            related["similar_patterns"].extend(patterns)
            
            # Search bugs
            bugs = knowledge_store.search_bug_knowledge(issue_type, n_results=2)
            related["related_bugs"].extend(bugs)
        
        return related
    
    def _generate_detailed_recommendations(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate detailed recommendations"""
        recommendations = []
        
        # Based on issues
        for issue in analysis.get("issues", []):
            if issue["severity"] == "critical":
                recommendations.append({
                    "priority": "high",
                    "action": "Immediate fix required",
                    "issue": issue["message"],
                    "impact": "System stability"
                })
            elif issue["severity"] == "high":
                recommendations.append({
                    "priority": "medium",
                    "action": "Plan fix",
                    "issue": issue["message"],
                    "impact": "Test coverage"
                })
        
        # Based on patterns
        for pattern in analysis.get("patterns", []):
            if pattern["count"] > 3:
                recommendations.append({
                    "priority": "low",
                    "action": "Review pattern",
                    "issue": f"Multiple tests with {pattern['status']} status",
                    "impact": "Test reliability"
                })
        
        return recommendations
    
    def _generate_summary(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate analysis summary"""
        return {
            "total_issues": len(analysis.get("issues", [])),
            "critical_issues": len([
                i for i in analysis.get("issues", [])
                if i.get("severity") == "critical"
            ]),
            "patterns_found": len(analysis.get("patterns", [])),
            "recommendations": len(analysis.get("recommendations", [])),
            "pass_rate": analysis.get("summary", {}).get("pass_rate", "N/A")
        }


# Crew instance
analysis_crew = AnalysisCrew()
