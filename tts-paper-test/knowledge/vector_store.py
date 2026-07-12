"""Vector store management for test knowledge"""

from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from core.config import settings


class TestKnowledgeStore:
    """Vector store for test knowledge"""
    
    def __init__(self):
        """Initialize the vector store"""
        persist_dir = settings.vector_db.persist_directory
        Path(persist_dir).mkdir(parents=True, exist_ok=True)
        
        self.client = chromadb.Client(ChromaSettings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_dir,
            anonymized_telemetry=False
        ))
        
        # Create collections
        self.test_patterns = self.client.get_or_create_collection(
            name="test_patterns",
            metadata={"hnsw:space": "cosine"}
        )
        self.bug_knowledge = self.client.get_or_create_collection(
            name="bug_knowledge",
            metadata={"hnsw:space": "cosine"}
        )
        self.test_results = self.client.get_or_create_collection(
            name="test_results",
            metadata={"hnsw:space": "cosine"}
        )
    
    def add_test_pattern(self, pattern: Dict[str, Any]) -> None:
        """Add a test pattern to the knowledge base"""
        self.test_patterns.add(
            documents=[pattern["description"]],
            metadatas=[pattern.get("metadata", {})],
            ids=[pattern["id"]]
        )
    
    def add_bug_knowledge(self, bug: Dict[str, Any]) -> None:
        """Add bug knowledge to the knowledge base"""
        self.bug_knowledge.add(
            documents=[bug["description"]],
            metadatas=[bug.get("metadata", {})],
            ids=[bug["id"]]
        )
    
    def add_test_result(self, result: Dict[str, Any]) -> None:
        """Add test result to the knowledge base"""
        self.test_results.add(
            documents=[result.get("message", "")],
            metadatas=[result.get("metadata", {})],
            ids=[result["id"]]
        )
    
    def search_test_patterns(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar test patterns"""
        results = self.test_patterns.query(
            query_texts=[query],
            n_results=n_results
        )
        return self._format_results(results)
    
    def search_bug_knowledge(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar bug knowledge"""
        results = self.bug_knowledge.query(
            query_texts=[query],
            n_results=n_results
        )
        return self._format_results(results)
    
    def search_test_results(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for similar test results"""
        results = self.test_results.query(
            query_texts=[query],
            n_results=n_results
        )
        return self._format_results(results)
    
    def _format_results(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format query results"""
        formatted = []
        if results and results.get("documents"):
            for i, doc in enumerate(results["documents"][0]):
                formatted.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    "id": results["ids"][0][i] if results.get("ids") else None,
                    "distance": results["distances"][0][i] if results.get("distances") else None
                })
        return formatted
    
    def get_stats(self) -> Dict[str, int]:
        """Get knowledge base statistics"""
        return {
            "test_patterns": self.test_patterns.count(),
            "bug_knowledge": self.bug_knowledge.count(),
            "test_results": self.test_results.count()
        }
    
    def delete_test_pattern(self, pattern_id: str) -> bool:
        """Delete a test pattern"""
        try:
            self.test_patterns.delete(ids=[pattern_id])
            return True
        except Exception:
            return False
    
    def delete_bug_knowledge(self, bug_id: str) -> bool:
        """Delete bug knowledge"""
        try:
            self.bug_knowledge.delete(ids=[bug_id])
            return True
        except Exception:
            return False
    
    def update_test_pattern(self, pattern: Dict[str, Any]) -> bool:
        """Update a test pattern"""
        try:
            self.test_patterns.update(
                ids=[pattern["id"]],
                documents=[pattern["description"]],
                metadatas=[pattern.get("metadata", {})]
            )
            return True
        except Exception:
            return False
    
    def get_all_patterns(self) -> List[Dict[str, Any]]:
        """Get all test patterns"""
        results = self.test_patterns.get()
        return self._format_results(results)
    
    def get_all_bugs(self) -> List[Dict[str, Any]]:
        """Get all bug knowledge"""
        results = self.bug_knowledge.get()
        return self._format_results(results)
    
    def search_by_category(self, category: str, collection: str = "patterns") -> List[Dict[str, Any]]:
        """Search by category"""
        target = self.test_patterns if collection == "patterns" else self.bug_knowledge
        results = target.get(where={"category": category})
        return self._format_results(results)


# Global instance
knowledge_store = TestKnowledgeStore()
