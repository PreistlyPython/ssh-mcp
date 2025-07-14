# Contributing to SSH-MCP

Thank you for your interest in contributing to SSH-MCP! This document provides guidelines and instructions for contributing.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/PreistlyPython/ssh-mcp.git
   cd ssh-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
   - Write clean, documented code
   - Follow existing patterns and conventions
   - Add tests for new functionality

5. **Run tests**
   ```bash
   npm test
   npm run lint
   ```

6. **Commit your changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

7. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add support for ed25519 SSH keys
fix: resolve connection timeout issue
docs: update API documentation
```

## 🏗️ Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing formatting (use `npm run lint`)
- Write descriptive variable and function names
- Add JSDoc comments for public APIs

### Testing
- Write unit tests for new functionality
- Ensure all tests pass before submitting PR
- Aim for >80% code coverage

### Security
- Never commit credentials or secrets
- Follow security best practices
- Review SECURITY.md before contributing

### Documentation
- Update README.md for new features
- Add JSDoc comments for new functions
- Include examples for complex features

## 🐛 Reporting Issues

### Bug Reports
Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Node version, etc)
- Error messages and logs

### Feature Requests
Include:
- Clear description of the feature
- Use cases and benefits
- Potential implementation approach
- Any relevant examples

## 🔍 Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass
   - Update documentation
   - Add changelog entry
   - Sign commits if required

2. **PR description should include:**
   - Summary of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (if applicable)

3. **Review process:**
   - Maintainers will review within 48 hours
   - Address feedback promptly
   - Be patient and respectful

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- TypeScript knowledge

### Local Development
```bash
# Install dependencies
npm install

# Run in watch mode
npm run watch

# Run tests
npm test

# Build project
npm run build

# Lint code
npm run lint
```

### Testing with MCP
```bash
# Use MCP inspector
npm run inspector

# Test with Claude Code
claude mcp add /path/to/your/fork
```

## 📚 Architecture Overview

```
ssh-mcp/
├── src/
│   ├── index.ts          # Main entry point
│   ├── tools/            # MCP tool implementations
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript types
├── tests/                # Test files
├── docs/                 # Documentation
└── build/                # Compiled output
```

## 🎯 Areas for Contribution

We especially welcome contributions in:
- New framework integrations (Python, Ruby, etc)
- Performance optimizations
- Security enhancements
- Documentation improvements
- Test coverage expansion
- Bug fixes

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in documentation

## 📞 Getting Help

- Check existing issues and discussions
- Email maintainer: andre@optinampout.com
- Business: OptinampOut (https://optinampout.com)

---

Thank you for contributing to SSH-MCP! Your efforts help make remote development better for everyone. 🚀