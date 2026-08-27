# GPT Agent Example

This example demonstrates using OpenAI GPT-5 models with DeepSeek Harness via a custom endpoint.

## Prerequisites

1. Set your OpenAI API key in the root `.env` file:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   OPENAI_BASE_URL=https://llmapi.xfcxb.com/v1
   ```

2. Configure models in `~/.dsh/settings.yaml` (already configured if you followed the setup)

## Quick Start

Run the GPT agent from the project root:

```bash
# Build the project first
pnpm run build

# Run with GPT-5-4
pnpm dsh --config examples/gpt-agent/cordis.yml "解释一下这个项目是做什么的"

# Or use environment variable to test
OPENAI_API_KEY=sk-xxx pnpm dsh --config examples/gpt-agent/cordis.yml "你好"
```

## Available Models

The following GPT-5 models are configured:
- `gpt-5-4` - GPT-5.4 (default, 最强性能)
- `gpt-5-4-mini` - GPT-5.4 Mini (快速版本)
- `gpt-5-5` - GPT-5.5 (增强版)
- `gpt-5-6-luna` - GPT-5.6 Luna (月光版本)
- `gpt-5-6-sol` - GPT-5.6 Sol (太阳版本)
- `gpt-5-6-terra` - GPT-5.6 Terra (大地版本)

## Switch Models

To use a different model, edit `cordis.yml` line 35:

```yaml
- id: agent-spine
  name: '@deepseek-ai/dsh-agent-spine-demo'
  config:
    agents:
      - id: main
        provider: openai
        model: gpt-5-6-luna  # Change this to any model from the list
```

Or override in settings.yaml:

```yaml
agent-default-model:
  provider: openai
  model: gpt-5-6-luna
```

## Custom Endpoint Configuration

This example uses a custom OpenAI compatible endpoint (`https://llmapi.xfcxb.com/v1`).

The configuration is in `~/.dsh/settings.yaml`:

```yaml
llm-pi-ai:
  providers:
    openai:
      apiKeyEnv: OPENAI_API_KEY
      baseURL: https://llmapi.xfcxb.com/v1  # 中转站地址
```

## Troubleshooting

1. **API Key Error**: Make sure `OPENAI_API_KEY` is set in `.env` or environment
2. **Model Not Found**: Check that the model is listed in `~/.dsh/settings.yaml`
3. **Connection Error**: Verify your internet connection or proxy settings
4. **中转站连接问题**: 检查 `OPENAI_BASE_URL` 是否正确配置
