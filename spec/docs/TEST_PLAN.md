# Test plan
Automated:
- Schema parsing and equipment ID uniqueness
- Valid equipment selection and deselection
- Camera mode transitions and reset
- Visual mode changes preserving selection
- Thruster command clamp and stop behavior
- DP numerical integration stability under zero and bounded disturbances
- Deployment invalid transition rejection
- Component unmount cleans animation subscriptions

Browser:
- Ship renders and orbit/zoom respond
- Click DP console/HPR/thruster opens correct panel
- System explorer focuses matching mesh
- Switch hybrid/blueprint/realistic/X-ray without blank scene
- Thruster simulation animates and reset stops it
- Return to overview always works
- Mobile touch controls and narrow screen
- Missing GLB uses fallback; no crash
- Reduced motion and keyboard-accessible list
- Build, lint and typecheck succeed
