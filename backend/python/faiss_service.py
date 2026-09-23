import sys
import json
import os
import argparse
import numpy as np
import faiss

def normalize_vectors(vectors):
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1e-10
    return vectors / norms

def cmd_build(args):
    index_file = args.index_file
    vectors_file = args.vectors_file
    
    if not os.path.exists(vectors_file):
        print(json.dumps({"success": False, "error": f"Vectors file not found: {vectors_file}"}))
        return

    with open(vectors_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    vectors_list = data.get("vectors", [])
    if not vectors_list:
        # Create empty or minimal index
        print(json.dumps({"success": False, "error": "No vectors provided"}))
        return

    vectors = np.array(vectors_list, dtype=np.float32)
    dim = vectors.shape[1]

    # Normalize vectors for Cosine Similarity using Inner Product
    vectors = normalize_vectors(vectors)
    index = faiss.IndexFlatIP(dim)
    index.add(vectors)

    os.makedirs(os.path.dirname(os.path.abspath(index_file)), exist_ok=True)
    faiss.write_index(index, index_file)

    print(json.dumps({
        "success": True,
        "message": f"Successfully built FAISS index with {index.ntotal} vectors.",
        "count": index.ntotal,
        "dimension": dim
    }))

def cmd_search(args):
    index_file = args.index_file
    query_vector_str = args.query_vector
    top_k = args.top_k

    if not os.path.exists(index_file):
        print(json.dumps({"success": False, "error": f"FAISS index file not found: {index_file}"}))
        return

    query_vec = json.loads(query_vector_str)
    query_arr = np.array([query_vec], dtype=np.float32)
    query_arr = normalize_vectors(query_arr)

    index = faiss.read_index(index_file)
    k = min(top_k, index.ntotal)
    if k == 0:
        print(json.dumps({"success": True, "results": []}))
        return

    scores, indices = index.search(query_arr, k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx != -1:
            results.append({
                "index": int(idx),
                "score": float(score)
            })

    print(json.dumps({"success": True, "results": results}))

def main():
    parser = argparse.ArgumentParser(description="FAISS Vector Index Service")
    subparsers = parser.add_subparsers(dest="command")

    build_parser = subparsers.add_parser("build")
    build_parser.add_argument("--index_file", required=True, help="Output FAISS index file path")
    build_parser.add_argument("--vectors_file", required=True, help="JSON file containing vectors array")

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("--index_file", required=True, help="FAISS index file path")
    search_parser.add_argument("--query_vector", required=True, help="JSON string of query vector float array")
    search_parser.add_argument("--top_k", type=int, default=5, help="Number of top matches to return")

    args = parser.parse_args()

    if args.command == "build":
        cmd_build(args)
    elif args.command == "search":
        cmd_search(args)
    else:
        print(json.dumps({"success": False, "error": "Invalid command"}))

if __name__ == "__main__":
    main()
