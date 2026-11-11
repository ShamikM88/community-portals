// Strict argument parsing: unknown flags, missing values, malformed numbers and unsupported
// formats are errors, never silently ignored. Pure, so it is tested without any network.

export class ArgError extends Error {
  code = "BAD_ARG"
}

type Kind = "string" | "int"

interface CommandSpec {
  flags: Record<string, Kind>
  formats: string[]
  positional: number
}

const SPECS: Record<string, CommandSpec> = {
  search: {
    flags: { query: "string", location: "string", jobage: "int", page: "int", limit: "int" },
    formats: ["json", "table", "plain"],
    positional: 0,
  },
  detail: { flags: {}, formats: ["json", "plain"], positional: 1 },
}

const ALIASES: Record<string, string> = { q: "query", l: "location", n: "limit" }

// Allowed range per numeric flag. A zero limit is valid: it asks for no results.
const RANGE: Record<string, [number, number]> = { page: [1, 1000], jobage: [1, 3650], limit: [0, 10000] }

export interface ParsedArgs {
  command?: string
  positional: string[]
  flags: Record<string, string | number>
  format: string
  help: boolean
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { positional: [], flags: {}, format: "json", help: false }
  if (argv.some((a) => a === "--help" || a === "-h")) {
    out.help = true
    return out
  }
  const first = argv[0]
  if (first === undefined) return out
  if (first.startsWith("-")) {
    throw new ArgError(`Put the command first (search or detail), got "${first}"`)
  }
  out.command = first
  // Own properties only, so names like "toString" are unknown commands, not inherited functions.
  const spec = Object.hasOwn(SPECS, first) ? SPECS[first] : undefined
  if (!spec) return out // the caller reports the unknown command

  for (let i = 1; i < argv.length; i++) {
    const tok = argv[i]!
    if (!tok.startsWith("-") || tok === "-") {
      out.positional.push(tok)
      continue
    }
    const body = tok.replace(/^-{1,2}/, "")
    const eq = body.indexOf("=")
    const rawName = eq >= 0 ? body.slice(0, eq) : body
    let value: string | undefined = eq >= 0 ? body.slice(eq + 1) : undefined
    const name = Object.hasOwn(ALIASES, rawName) ? ALIASES[rawName]! : rawName
    const kind = name === "format" ? "format" : Object.hasOwn(spec.flags, name) ? spec.flags[name] : undefined
    if (!kind) throw new ArgError(`Unknown flag "${tok}" for ${first}`)
    if (value === undefined) {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        throw new ArgError(`--${name} needs a value (use --${name}=<value> if the value starts with "-")`)
      }
      value = next
      i++
    }
    if (value === "") {
      throw new ArgError(`--${name} needs a non-empty value`)
    }
    if (name === "format") {
      if (!spec.formats.includes(value)) {
        throw new ArgError(`--format must be one of ${spec.formats.join(", ")}, got "${value}"`)
      }
      out.format = value
    } else if (kind === "int") {
      const [lo, hi] = RANGE[name] ?? [1, 1000]
      const n = Number(value)
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < lo || n > hi) {
        throw new ArgError(`--${name} must be a whole number from ${lo} to ${hi}, got "${value.slice(0, 20)}"`)
      }
      out.flags[name] = n
    } else {
      out.flags[name] = value
    }
  }
  if (out.positional.length > spec.positional) {
    throw new ArgError(`Unexpected argument "${out.positional[spec.positional]}"`)
  }
  return out
}
