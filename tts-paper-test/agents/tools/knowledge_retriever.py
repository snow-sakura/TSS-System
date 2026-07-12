"""Knowledge retriever tool for accessing test knowledge base"""

from typing import Any, Dict, List

from knowledge.vector_store import knowledge_store


class KnowledgeRetrieverTool:
    """Tool for retrieving knowledge from the vector store"""
    
    def search_test_patterns(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar test patterns"""
        return knowledge_store.search_test_patterns(query, n_results)
    
    def search_bug_knowledge(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar bug knowledge"""
        return knowledge_store.search_bug_knowledge(query, n_results)
    
    def search_test_results(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar test results"""
        return knowledge_store.search_test_results(query, n_results)
    
    def get_relevant_patterns(self, test_type: str, feature: str) -> str:
        """Get relevant test patterns for a specific feature"""
        query = f"{test_type} testing for {feature}"
        patterns = self.search_test_patterns(query, n_results=3)
        
        if not patterns:
            return "No relevant patterns found."
        
        result = "Relevant test patterns:\n\n"
        for i, pattern in enumerate(patterns, 1):
            result += f"{i}. {pattern['content']}\n\n"
        
        return result
    
    def get_related_bugs(self, feature: str) -> str:
        """Get related bugs for a specific feature"""
        query = f"bugs related to {feature}"
        bugs = self.search_bug_knowledge(query, n_results=3)
        
        if not bugs:
            return "No related bugs found."
        
        result = "Related bugs:\n\n"
        for i, bug in enumerate(bugs, 1):
            result += f"{i}. {bug['content']}\n\n"
        
        return result
    
    def get_stats(self) -> Dict[str, int]:
        """Get knowledge base statistics"""
        return knowledge_store.get_stats()


# Tool instance
knowledge_retriever_tool = KnowledgeRetrieverTool()
