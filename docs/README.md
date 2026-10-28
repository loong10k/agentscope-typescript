# AgentScope Documentation

> **GARR 跨语言唯一规范**：[GARR Unified Contract v0.1](./garr/GARR-UNIFIED-CONTRACT-v0.1.md)；[TypeScript API 适配说明](./garr-implementation-v0.1.md)。当前未实现，不代表 Mintlify 导航已发布该功能。

This directory contains the Mintlify documentation for AgentScope.

## Development

### Install Mintlify CLI

```bash
npm install -g mintlify
```

### Run Locally

```bash
cd docs
mintlify dev
```

The documentation will be available at `http://localhost:3000`.

## Structure

```
docs/
├── mint.json                 # Mintlify configuration
├── introduction.mdx          # Homepage
├── getting-started/          # Installation and quickstart
├── core/                     # Core library documentation
│   ├── overview.mdx
│   ├── agent.mdx
│   ├── model.mdx
│   ├── tool.mdx
│   ├── event.mdx
│   ├── memory.mdx
│   └── examples/            # Code examples
├── friday/                   # Friday app documentation
│   ├── overview.mdx
│   ├── installation.mdx
│   ├── user-guide.mdx
│   ├── architecture.mdx
│   └── development.mdx
├── api-reference/            # API documentation
│   ├── overview.mdx
│   ├── agent.mdx
│   ├── model.mdx
│   ├── toolkit.mdx
│   └── event-system.mdx
└── guides/                   # Advanced guides
    ├── mcp-integration.mdx
    ├── custom-skills.mdx
    ├── human-in-the-loop.mdx
    └── deployment.mdx
```

## Deployment

The documentation can be deployed to Mintlify's hosting platform:

```bash
mintlify deploy
```

Or you can build static files:

```bash
mintlify build
```

## Contributing

When adding new documentation:

1. Create `.mdx` files in the appropriate directory
2. Update `mint.json` navigation to include the new pages
3. Use Mintlify components for better formatting (Card, CardGroup, ParamField, etc.)
4. Test locally before committing

## Mintlify Components

### Cards

```mdx
<Card title="Title" icon="icon-name" href="/path">
    Description
</Card>
```

### Code Groups

````mdx
<CodeGroup>
```bash npm
npm install package
````

```bash pnpm
pnpm add package
```

</CodeGroup>
```

### Parameter Fields

```mdx
<ParamField path="name" type="string" required>
    Description
</ParamField>
```

### Callouts

```mdx
<Tip>Helpful tip</Tip>
<Warning>Warning message</Warning>
<Info>Information</Info>
```

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [Mintlify Components](https://mintlify.com/docs/components)
- [MDX Syntax](https://mdxjs.com/)
