import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

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

		const extension = entry.slice(entry.lastIndexOf("."))
		if (includeExtensions.has(extension)) {
			files.push(absolutePath)
		}
	}

	return files
}

function isAllowedPath(workspaceRelativePath) {
	if (workspaceRelativePath.endsWith("queries/keys.ts")) {
		return true
	}

	if (workspaceRelativePath.includes("/queries/keys.ts")) {
		return true
	}

	return false
}

function findLiteralQueryKeyViolations(filePath) {
	const content = readFileSync(filePath, "utf8")
	const violations = []

	const regex = /queryKey\s*:\s*\[/g
	let match = regex.exec(content)

	while (match) {
		const before = content.slice(0, match.index)
		const line = before.split("\n").length
		violations.push(line)
		match = regex.exec(content)
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

	const violations = findLiteralQueryKeyViolations(filePath)
	for (const line of violations) {
		allViolations.push({ path: workspaceRelativePath, line })
	}
}

if (allViolations.length > 0) {
	console.error(
		"Found literal queryKey array usage outside query key factories:",
	)
	for (const violation of allViolations) {
		console.error(`- ${violation.path}:${violation.line}`)
	}
	console.error(
		"Use domain key factories (e.g. features/*/queries/keys.ts) instead of inline array query keys.",
	)
	process.exit(1)
}

console.log("Query key guard passed.")
