# Development Guidelines for Vibe Coding RAG

## Commands
- Build/Install: `poetry install`
- Run: `poetry run python -m app.main` (once app is created)
- Lint: `poetry run ruff check .`
- Format: `poetry run ruff format .`
- Test: `poetry run pytest`
- Run single test: `poetry run pytest path/to/test.py::test_function_name -v`

## Code Style
- **Imports**: Group standard library, third-party, and local imports
- **Formatting**: Use Black/Ruff compatible formatting
- **Types**: Use type annotations for function parameters and return values
- **Naming**:
  - Variables/functions: snake_case
  - Classes: PascalCase
  - Constants: UPPER_SNAKE_CASE
- **Error Handling**: Use try/except with specific exceptions
- **Documentation**: Docstrings for all public functions and classes

## Technologies
- Vector DB: Qdrant
- Embeddings: SentenceTransformers with sentence-transformers/static-retrieval-mrl-en-v1
- API: FastAPI (when implemented)
- Frontend: HTML/CSS/JavaScript with DaisyUI components

## MCP Integration
- Always call qdrant-code-search find tool when you are about to generate frontend code (HTML/CSS/JS)
- Store generated code snippets in qdrant-code-search store tool for future reference

## Qdrant
- Point IDs have to be string-like UUIDs