"""Small CPU exercises; run from the repository root with Python and NumPy."""

from collections import Counter

import numpy as np


def nearest_indices(points, queries, count, mode="blocked", block_size=32):
    points = np.asarray(points, dtype=np.float64)
    queries = np.asarray(queries, dtype=np.float64)
    if points.ndim != 2 or queries.ndim != 2 or points.shape[1] != queries.shape[1]:
        raise ValueError("Expected [N,D] points and [Q,D] queries")
    if points.shape[1] == 0 or not np.isfinite(points).all() or not np.isfinite(queries).all():
        raise ValueError("Expected positive feature width and finite coordinates")
    if type(count) is not int or not 1 <= count <= len(points):
        raise ValueError("count must be between 1 and the number of points")
    if mode not in {"loop", "vectorized", "blocked"}:
        raise ValueError("Unknown distance implementation")
    if type(block_size) is not int or block_size < 1:
        raise ValueError("block_size must be positive")
    neighbors = np.empty((len(queries), count), dtype=np.int64)
    chunk_size = max(1, len(queries)) if mode == "vectorized" else block_size
    if mode == "loop":
        chunk_size = 1
    for start in range(0, len(queries), chunk_size):
        chunk = queries[start:start + chunk_size]
        if mode == "loop":
            distances = np.array([[sum((float(left) - float(right)) ** 2
                                      for left, right in zip(chunk[0], point))
                                   for point in points]])
        else:
            differences = chunk[:, None, :] - points[None, :, :]
            distances = np.einsum("qnd,qnd->qn", differences, differences)
        if not np.isfinite(distances).all():
            raise ValueError("Squared distances overflowed; rescale the input")
        neighbors[start:start + len(chunk)] = np.argsort(distances, axis=1, kind="stable")[:, :count]
    return neighbors


def knn_predict(points, labels, queries, count, **options):
    labels = np.asarray(labels)
    if labels.ndim != 1 or len(labels) != len(points) or labels.dtype.kind not in "iu":
        raise ValueError("Expected one integer label per point")
    indices = nearest_indices(points, queries, count, **options)
    predictions = []
    for neighbors in indices:
        votes = Counter(int(labels[index]) for index in neighbors)
        predictions.append(min(votes, key=lambda label: (-votes[label], label)))
    return np.asarray(predictions, dtype=labels.dtype)


def search_bounds(values, target):
    def insertion(after_equal):
        lower, upper = 0, len(values)
        while lower < upper:
            middle = (lower + upper) // 2
            move_right = values[middle] < target or (after_equal and values[middle] == target)
            if move_right:
                lower = middle + 1
            else:
                upper = middle
        return lower

    return insertion(False), insertion(True) - 1


def dependency_layers(dependencies):
    predecessors = {task: set(required) for task, required in dependencies.items()}
    if any(required - predecessors.keys() for required in predecessors.values()):
        raise ValueError("Every predecessor must be declared as a task")
    successors = {task: [] for task in predecessors}
    remaining = {task: len(required) for task, required in predecessors.items()}
    for task, required in predecessors.items():
        for predecessor in required:
            successors[predecessor].append(task)
    ready = [task for task in predecessors if remaining[task] == 0]
    layers, completed = [], 0
    while ready:
        layers.append(ready)
        completed += len(ready)
        next_ready = []
        for task in ready:
            for successor in successors[task]:
                remaining[successor] -= 1
                if remaining[successor] == 0:
                    next_ready.append(successor)
        ready = next_ready
    if completed != len(predecessors):
        raise ValueError("A directed cycle prevents a complete schedule")
    return layers


def markov_example():
    transition = np.array([[0.8, 0.2], [0.4, 0.6]])
    start = np.array([1.0, 0.0])
    after_two = start @ np.linalg.matrix_power(transition, 2)
    equations = transition.T - np.eye(2)
    equations[-1] = 1
    stationary = np.linalg.solve(equations, np.array([0.0, 1.0]))
    transient = transition[:1, :1]
    hitting = np.linalg.solve(np.eye(1) - transient, np.ones(1))
    return after_two, stationary, hitting[0]


def main():
    points = [[0, 0], [2, 0], [0, 3]]
    queries = [[1, 0], [0, 2]]
    expected = [[0, 1], [2, 0]]
    for mode in ("loop", "vectorized", "blocked"):
        np.testing.assert_array_equal(nearest_indices(points, queries, 2, mode=mode, block_size=1), expected)
        np.testing.assert_array_equal(knn_predict(points, [0, 1, 1], queries, 1, mode=mode), [0, 1])
    assert search_bounds([1, 2, 2, 4], 2) == (1, 2)
    assert dependency_layers({"read": [], "clean": ["read"], "audit": ["read"],
                              "train": ["clean", "audit"]}) == [["read"], ["clean", "audit"], ["train"]]
    after_two, stationary, hitting = markov_example()
    np.testing.assert_allclose(after_two, [0.72, 0.28])
    np.testing.assert_allclose(stationary, [2 / 3, 1 / 3])
    np.testing.assert_allclose(hitting, 5)
    print("kNN, boundaries, dependencies, and Markov checks passed")


if __name__ == "__main__":
    main()
