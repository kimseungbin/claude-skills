---
name: Deployment Issue
about: Document deployment failures, CI/CD problems, or infrastructure deployment issues
title: "[Deployment] "
labels: deployment-issue, retrospective
---

<!--
INSTRUCTIONS FOR CLAUDE CODE:
- Fill all sections based on user's description
- Use mermaid diagrams for dependency flows and circular dependencies
- Add [!WARNING] for critical blockers, [!TIP] for workarounds, [!IMPORTANT] for root causes
- Use <details> for technical deep-dives (CDK code, CloudFormation analysis, etc.)
- Include specific resource names, stack names, and error messages
-->

**Date:** YYYY-MM-DD
**Environment:** Production / Staging / Development
**Status:** Resolved / Mitigated / Investigating

## Summary

<!-- 2-3 sentences: what failed, which stack/pipeline, and resolution status -->

## Deployment Timeline

<!-- Numbered chronological steps of the deployment attempt -->

1. **HH:MM** - Deployment started
2. **HH:MM** - Issue observed

## Root Cause Analysis

<!--
Why did the deployment fail?
- Use mermaid diagram for circular dependencies or resource relationships
- Reference specific CloudFormation/CDK resources
- Explain the blocking condition
-->

## Current Implementation Issues

<!--
What's wrong with the current approach?
- Use [!WARNING] for critical issues
- Number each distinct issue
-->

## Solution

<!--
How was it resolved?
- Immediate workaround (if any)
- Permanent fix with code examples
- Use [!TIP] for recommended approaches
-->

## Retrospective

<!-- What would have prevented this? Action items for future deployments -->

## Related Documentation

<!-- Links to relevant docs, CDK constructs, or previous deployment issues -->

## References

<!-- AWS docs, GitHub issues, Stack Overflow, etc. -->

<details>
<summary><strong>Appendix: Technical Deep-Dive</strong></summary>

<!-- Detailed technical analysis, full error logs, CDK/CloudFormation snippets -->

</details>