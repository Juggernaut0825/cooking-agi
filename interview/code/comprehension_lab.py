class BuggyEmbeddingCache:
    def __init__(self, encode):
        self.encode = encode
        self.values = {}

    def get(self, model_version, text):
        if not self.values.get(text):
            self.values[text] = self.encode(model_version, text)
        return self.values[text]


class EmbeddingCache:
    def __init__(self, encode):
        self.encode = encode
        self.values = {}

    def get(self, model_version, text):
        key = (model_version, text)
        if key not in self.values:
            self.values[key] = list(self.encode(model_version, text))
        return self.values[key].copy()


def buggy_token_mean(batches):
    means = [sum(batch) / len(batch) for batch in batches if batch]
    return sum(means) / len(means)


def token_mean(batches):
    total_loss = 0.0
    token_count = 0
    for batch in batches:
        total_loss += sum(batch)
        token_count += len(batch)
    if token_count == 0:
        raise ValueError("No valid tokens")
    return total_loss / token_count


def example():
    calls = []

    def encode(model_version, text):
        calls.append((model_version, text))
        return [len(text), 1 if model_version == "v1" else 2]

    buggy = BuggyEmbeddingCache(encode)
    print("buggy:", buggy.get("v1", "cat"), buggy.get("v2", "cat"))
    correct = EmbeddingCache(encode)
    print("fixed:", correct.get("v1", "cat"), correct.get("v2", "cat"))
    batches = [[2.0, 2.0], [8.0]]
    print("batch mean:", buggy_token_mean(batches))
    print("token mean:", token_mean(batches))


if __name__ == "__main__":
    example()
