import { readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"

const rootDir = process.cwd()

const includeExtensions = new Set([".ts", ".tsx"])
const ignoreDirectories = new Set([
	".git",
	".next",
	"node_modules",
	"drizzle",
	"public",
])

function listSourceFiles(directory) {
	const entries = readdirSync(directory)
	const files = []

	for (const entry of entries) {
		const absolutePath = join(directory, entry)
		const entryStat = statSync(absolutePath)

		if (entryStat.isDirectory()) {
			if (ignoreDirectories.has(entry)) {
				continue
			}

			files.push(...listSourceFiles(absolutePath))
			continue
		}

		if (!entryStat.isFile()) {
			continue
		}

		if (includeExtensions.has(extname(entry))) {
			files.push(absolutePath)
		}
	}

	return files
}

function isAllowedPath(workspaceRelativePath) {
	if (workspaceRelativePath === "config/routes.ts") {
		return true
	}

	if (workspaceRelativePath.startsWith("scripts/")) {
		return true
	}

	return false
}

function findRouteLiteralViolations(filePath) {
	const content = readFileSync(filePath, "utf8")
	const violations = []
	const routeLiteralPattern = /(["'`])\/app(?:\/[a-zA-Z0-9-_/]*)?\1/g

	let match = routeLiteralPattern.exec(content)
	while (match) {
		const before = content.slice(0, match.index)
		const line = before.split("\n").length
		violations.push({ line, literal: match[0].slice(1, -1) })
		match = routeLiteralPattern.exec(content)
	}

	return violations
}

const sourceFiles = listSourceFiles(rootDir)
const allViolations = []

for (const filePath of sourceFiles) {
	const workspaceRelativePath = relative(rootDir, filePath).replaceAll(
		"\\",
		"/",
	)

	if (isAllowedPath(workspaceRelativePath)) {
		continue
	}

	const violations = findRouteLiteralViolations(filePath)
	for (const violation of violations) {
		allViolations.push({
			path: workspaceRelativePath,
			line: violation.line,
			literal: violation.literal,
		})
	}
}

if (allViolations.length > 0) {
	console.error("Found hardcoded app route literals outside config/routes.ts:")
	for (const violation of allViolations) {
		console.error(
			`- ${violation.path}:${violation.line} uses "${violation.literal}"`,
		)
	}
	console.error(
		"Use route constants from config/routes.ts instead of hardcoded app paths.",
	)
	process.exit(1)
}

console.log("Route literal guard passed.")
