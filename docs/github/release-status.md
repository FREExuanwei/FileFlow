# 0.2.0-rc.1 release status

**Source-only publication. Windows release stays Draft; no installer asset is uploaded.**

The locally accepted installer is FileFlow_0.2.0-rc.1_x64-setup.exe,4,371,566bytes, SHA-256:

EFBB328A2696284083164C5089040A6D72EEBC24BADEB889A2B9F90B2037E401

This identifies the owner's existing local file, not a public download. Authenticode status: NotSigned. The release body must say Pre-release, not stable/production/independently audited.

Distribution gates:
1. Accepted executable has142 developer-workstation Cargo source-path strings. Do not publish it without addressing or explicitly resolving that disclosure; never silently replace its hash.
2. Symbolic-link assertions remain privilege-unverified; the fresh junction fixture also failed creating. Prior35 native passes/junction evidence and owner checks are disclosed, not complete coverage.
3. Exact MPL source links/checksums and full notices are reviewed separately; installer publication needs its recipient-facing companion/source information.
4. First-party source licensing is undecided. GitHub source visibility is authorized, but no general open-source license is assigned.
5. Public binary publication needs the owner's final specific approval after the above review.

Recommended next action: keep this draft, separately approve a next RC build with supported path remapping, binary inspection and renewed targeted validation. No certificate purchase, cloud deployment, OCR rewrite or product-core change is needed for this source publication.
