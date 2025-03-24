---
title: "Qdrant Webinar: Vibe Coding Rag"
emoji: 🏆
colorFrom: pink
colorTo: indigo
sdk: docker
pinned: false
license: apache-2.0
short_description: YouTube In-Video Search
---

# webinar-vibe-coding-rag

**This repository contains materials for the hands-on "[Letting LLMs Write RAG 
Applications](https://try.qdrant.tech/llm-rag)" webinar.**

## Project Overview: YouTube In-Video Search

When learning a new skill, YouTube videos can be a great resource. However, in-depth content is often lengthy and may 
assume no prior knowledge. What if you could have a smart assistant to help you navigate through videos and find exactly 
what you need? This project creates a search engine for video content, helping you skim through and focus on what 
matters specifically to you.

Retrieval Augmented Generation (RAG) is perfect for this task. By indexing a video's transcript, we provide an interface 
to search through its content. Users can click on search results to jump to the exact timestamp where a topic is 
discussed.

### How It Works

The application has two main views:

1. **Input View**: 
   - User provides a YouTube video URL
   - Backend processes the video by:
     - Extracting the transcript
     - Dividing it into 30-second chunks with 10-second overlaps
     - Creating embeddings using SentenceTransformers
     - Storing these vectors in Qdrant

2. **Video View**:
   - Displays the video alongside its transcription
   - Allows clicking on timestamps to jump to specific parts
   - Provides a search bar to filter content
   - When a query is submitted, backend returns the most relevant video segments
   - Results appear as clickable links, while hiding irrelevant parts of the transcript

If a video has been processed previously, the application uses existing embeddings without reprocessing.

### Technologies Used

This project uses the following tools:

- [Qdrant](https://qdrant.tech/) - Vector search engine for both coding and in-video search
- [SentenceTransformers](https://www.sbert.net/) - Pre-trained models for sentence embeddings (using 
  `sentence-transformers/static-retrieval-mrl-en-v1`)
- [FastAPI](https://fastapi.tiangolo.com/) - Framework for the REST API and serving the frontend
- [DaisyUI](https://daisyui.com/) - Reusable frontend components for Tailwind CSS
- Pure HTML, CSS, and vanilla JavaScript

## Setup Instructions

### Setting up mcp-server-qdrant

The `mcp-server-qdrant` exposes two tools that interact with Qdrant:

- `qdrant-find` - Search for similar entries in the Qdrant index
- `qdrant-store` - Store new entries in the Qdrant index for future reference

The LLM decides when to use these tools based on their descriptions.

#### Configuring Tool Descriptions

Configure the tools using environmental variables:

```bash
export TOOL_FIND_DESCRIPTION="Use this tool ALWAYS before generating any FRONTEND code. \
It lets you search for relevant code snippets based on natural language descriptions. \
The 'query' parameter should describe what you're looking for, and the tool will return the most relevant code \
snippets. If this tool finds something similar, then create your code so it is consistent. Reuse existing code \
as much as you can."

export TOOL_STORE_DESCRIPTION="Store reusable FRONTEND code snippets for later retrieval. \
The 'information' parameter should contain a natural language description of what the code does, while the actual \
code should be included in the 'metadata' parameter as a 'code' property. The value of 'metadata' is a Python \
dictionary with strings as keys. Use this always when you generate some code to store it for further reference."
```

**Note:** You can customize these descriptions to better suit your specific use case.

#### Adding MCP Server to Claude Code

Add the `mcp-server-qdrant` to available tools in Claude Code:

```bash
claude mcp add qdrant-code-search \
  -e QDRANT_URL="http://localhost:6333" \
  -e COLLECTION_NAME="mcp-server-qdrant-knowledge-base" \
  -e TOOL_FIND_DESCRIPTION="$TOOL_FIND_DESCRIPTION" \
  -e TOOL_STORE_DESCRIPTION="$TOOL_STORE_DESCRIPTION" \
  -- uvx mcp-server-qdrant
```

Claude Code should always use the `qdrant-code-search` MCP before generating any code. When we accept generated code,
it should store it in the `qdrant-code-search` server for future reference.

### Initializing the Component Knowledge Base

We'll use a specific version of [DaisyUI](https://daisyui.com/) that the LLM may not be trained on. Qdrant will serve as 
a knowledge base for the LLM by storing DaisyUI components.

Run the `.scripts/run-qdrant.sh` script to load DaisyUI components into Qdrant. You can view the collection's content in 
the Web UI at [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

## Running the Application

Now we can start the actual vibe coding. **Note: We cannot guarantee the LLM will generate code that works out of the 
box, but let's try!**

### Example YouTube Videos

Andrej Karpathy publishes many interesting but lengthy videos on his YouTube channel. Here are some examples you can use 
with this application:

- [\[1hr Talk\] Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Deep Dive into LLMs like ChatGPT](https://www.youtube.com/watch?v=7xTGNNLPyMI)
- [How I use LLMs](https://www.youtube.com/watch?v=EWvNQjAaOHw)

If our vibe coding session is successful, we should be able to process these videos and search through their content 
effectively.
