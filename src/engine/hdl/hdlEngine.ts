import type { CircuitDocument, CircuitNode, CircuitWire } from '../../types/circuit';
import type {
  HDLAssign,
  HDLError,
  HDLExpr,
  HDLModuleAST,
  HDLParseResult,
  HDLPort,
  HDLSimulationRow,
} from '../../types/hdl';

interface Token {
  type: 'ident' | 'const' | 'op' | 'punct';
  value: string;
  line: number;
  column: number;
}

export interface HDLPreset {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const HDL_PRESETS: HDLPreset[] = [
  {
    id: 'and-gate',
    name: 'AND Gate',
    description: 'Basic 2-input combinational AND gate module.',
    code: `module and_gate(
    input wire a,
    input wire b,
    output wire y
);

assign y = a & b;

endmodule`,
  },
  {
    id: 'half-adder',
    name: 'Half Adder',
    description: 'Computes 1-bit sum and carry using XOR and AND assignments.',
    code: `module half_adder(
    input wire a,
    input wire b,
    output wire sum,
    output wire carry
);

assign sum = a ^ b;
assign carry = a & b;

endmodule`,
  },
  {
    id: 'full-adder',
    name: 'Full Adder',
    description: 'Uses an internal wire to compute 1-bit addition with carry-in.',
    code: `module full_adder(
    input wire a,
    input wire b,
    input wire cin,
    output wire sum,
    output wire cout
);

wire p;
assign p = a ^ b;
assign sum = p ^ cin;
assign cout = (a & b) | (p & cin);

endmodule`,
  },
  {
    id: 'mux-2to1',
    name: '2:1 Multiplexer',
    description: 'Selects between d0 and d1 using ternary or Boolean SOP form.',
    code: `module mux_2to1(
    input wire d0,
    input wire d1,
    input wire sel,
    output wire y
);

assign y = (~sel & d0) | (sel & d1);

endmodule`,
  },
  {
    id: 'decoder-2to4',
    name: '2-to-4 Decoder',
    description: 'Decodes 2-bit input (a1, a0) into four active-HIGH lines.',
    code: `module decoder_2to4(
    input wire a0,
    input wire a1,
    output wire y0,
    output wire y1,
    output wire y2,
    output wire y3
);

assign y0 = ~a1 & ~a0;
assign y1 = ~a1 & a0;
assign y2 = a1 & ~a0;
assign y3 = a1 & a0;

endmodule`,
  },
];

function stripCommentsPreserveLines(source: string): string {
  // Replace block comments with spaces/newlines to keep line numbers accurate
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, ' ')
  );
  // Strip single-line comments
  out = out.replace(/\/\/[^\n]*/g, '');
  return out;
}

function tokenizeExpression(expr: string, line: number, baseCol: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === '~&' || two === '~|' || two === '~^') {
      tokens.push({ type: 'op', value: two, line, column: baseCol + i });
      i += 2;
      continue;
    }
    if ('&|^~!?:'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, line, column: baseCol + i });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'punct', value: ch, line, column: baseCol + i });
      i++;
      continue;
    }
    // Verilog 1-bit constants: 1'b0, 1'b1, 0, 1
    const constMatch = expr.slice(i).match(/^(1'b[01]|[01])\b/);
    if (constMatch) {
      tokens.push({ type: 'const', value: constMatch[1], line, column: baseCol + i });
      i += constMatch[1].length;
      continue;
    }
    const idMatch = expr.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (idMatch) {
      tokens.push({ type: 'ident', value: idMatch[0], line, column: baseCol + i });
      i += idMatch[0].length;
      continue;
    }
    throw {
      line,
      column: baseCol + i + 1,
      message: `Unexpected character "${ch}" in expression.`,
      suggestion: 'Supported operators are ~, !, &, |, ^, ~&, ~|, ~^, ?:, and parentheses.',
    } satisfies HDLError;
  }
  return tokens;
}

function parseExpressionTokens(tokens: Token[], line: number): HDLExpr {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  // Precedence (lowest to highest): ternary ?: -> | / ~| -> ^ / ~^ -> & / ~& -> unary ~/! -> primary
  const parseTernary = (): HDLExpr => {
    const cond = parseOr();
    if (peek()?.type === 'op' && peek()?.value === '?') {
      consume();
      const whenTrue = parseTernary();
      if (peek()?.type !== 'op' || peek()?.value !== ':') {
        throw {
          line,
          column: peek()?.column ?? 1,
          message: 'Expected ":" in ternary conditional expression.',
          suggestion: 'Use syntax: condition ? expr_if_1 : expr_if_0',
        } satisfies HDLError;
      }
      consume();
      const whenFalse = parseTernary();
      return { kind: 'ternary', condition: cond, whenTrue, whenFalse };
    }
    return cond;
  };

  const parseOr = (): HDLExpr => {
    let left = parseXor();
    while (peek()?.type === 'op' && (peek()?.value === '|' || peek()?.value === '~|')) {
      const op = consume().value as '|' | '~|';
      const right = parseXor();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  const parseXor = (): HDLExpr => {
    let left = parseAnd();
    while (peek()?.type === 'op' && (peek()?.value === '^' || peek()?.value === '~^')) {
      const op = consume().value as '^' | '~^';
      const right = parseAnd();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  const parseAnd = (): HDLExpr => {
    let left = parseUnary();
    while (peek()?.type === 'op' && (peek()?.value === '&' || peek()?.value === '~&')) {
      const op = consume().value as '&' | '~&';
      const right = parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  const parseUnary = (): HDLExpr => {
    if (peek()?.type === 'op' && (peek()?.value === '~' || peek()?.value === '!')) {
      const op = consume().value as '~' | '!';
      return { kind: 'unary', op, operand: parseUnary() };
    }
    return parsePrimary();
  };

  const parsePrimary = (): HDLExpr => {
    const tok = peek();
    if (!tok) {
      throw {
        line,
        column: 1,
        message: 'Unexpected end of expression.',
        suggestion: 'Complete the right-hand side of the assign statement before ";".',
      } satisfies HDLError;
    }
    if (tok.type === 'punct' && tok.value === '(') {
      consume();
      const inner = parseTernary();
      if (peek()?.type !== 'punct' || peek()?.value !== ')') {
        throw {
          line,
          column: tok.column,
          message: 'Unclosed parenthesis "(" in expression.',
          suggestion: 'Add a matching ")" to close the sub-expression.',
        } satisfies HDLError;
      }
      consume();
      return inner;
    }
    if (tok.type === 'const') {
      consume();
      const v: 0 | 1 = tok.value.endsWith('1') ? 1 : 0;
      return { kind: 'const', value: v };
    }
    if (tok.type === 'ident') {
      consume();
      return { kind: 'ident', name: tok.value };
    }
    throw {
      line: tok.line,
      column: tok.column,
      message: `Unexpected token "${tok.value}".`,
      suggestion: 'Expected a signal name, constant (0/1), or parenthesized expression.',
    } satisfies HDLError;
  };

  const ast = parseTernary();
  if (pos < tokens.length) {
    const extra = tokens[pos];
    throw {
      line: extra.line,
      column: extra.column,
      message: `Unexpected trailing token "${extra.value}".`,
      suggestion: 'Check for a missing operator (&, |, ^) between signal names.',
    } satisfies HDLError;
  }
  return ast;
}

export function parseHDL(source: string): HDLParseResult {
  const errors: HDLError[] = [];
  const warnings: HDLError[] = [];
  const clean = stripCommentsPreserveLines(source);

  // Check for explicitly unsupported Verilog constructs to give helpful diagnostics
  const unsupportedPatterns: Array<{ regex: RegExp; feature: string }> = [
    { regex: /\balways\b/, feature: 'Procedural always blocks (sequential HDL)' },
    { regex: /\breg\b/, feature: 'reg declarations' },
    { regex: /\binitial\b/, feature: 'initial blocks' },
    { regex: /\[\s*\d+\s*:\s*\d+\s*\]/, feature: 'Multi-bit vector port ranges [msb:lsb]' },
  ];
  for (const item of unsupportedPatterns) {
    const m = clean.match(item.regex);
    if (m && m.index !== undefined) {
      const line = clean.slice(0, m.index).split('\n').length;
      errors.push({
        line,
        column: 1,
        message: `Unsupported Verilog feature: ${item.feature}.`,
        suggestion:
          'ChipCraft HDL Studio supports an educational combinational subset: module, scalar input/output wires, internal wires, and assign statements.',
      });
    }
  }
  if (errors.length > 0) {
    return { success: false, ast: null, errors, warnings };
  }

  const moduleHeader = clean.match(/module\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*;/);
  if (!moduleHeader) {
    errors.push({
      line: 1,
      column: 1,
      message: 'Missing or malformed module header.',
      suggestion: 'Start with: module my_module(input wire a, output wire y);',
    });
    return { success: false, ast: null, errors, warnings };
  }

  const endmoduleMatch = clean.match(/\bendmodule\b/);
  if (!endmoduleMatch) {
    errors.push({
      line: clean.split('\n').length,
      column: 1,
      message: 'Missing "endmodule" terminator.',
      suggestion: 'Close the module definition with endmodule.',
    });
    return { success: false, ast: null, errors, warnings };
  }

  const moduleName = moduleHeader[1];
  const portListRaw = moduleHeader[2];
  const ports: HDLPort[] = [];
  const declaredSignals = new Set<string>();

  const portEntries = portListRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of portEntries) {
    const m = entry.match(/^(input|output)\s+(?:wire\s+)?([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!m) {
      errors.push({
        line: 2,
        column: 1,
        message: `Invalid port declaration "${entry}".`,
        suggestion: 'Declare ports as "input wire name" or "output wire name".',
      });
      continue;
    }
    const direction = m[1] as 'input' | 'output';
    const name = m[2];
    if (declaredSignals.has(name)) {
      errors.push({
        line: 2,
        column: 1,
        message: `Duplicate port name "${name}".`,
        suggestion: 'Every port must have a unique identifier.',
      });
      continue;
    }
    declaredSignals.add(name);
    ports.push({ name, direction, width: 1 });
  }

  const bodyStartIdx = (moduleHeader.index ?? 0) + moduleHeader[0].length;
  const bodyEndIdx = endmoduleMatch.index ?? clean.length;
  const body = clean.slice(bodyStartIdx, bodyEndIdx);
  const bodyStartLine = clean.slice(0, bodyStartIdx).split('\n').length;

  const internalWires: string[] = [];
  const assignments: HDLAssign[] = [];

  // Parse statements separated by semicolons
  let cursor = 0;
  while (cursor < body.length) {
    const semi = body.indexOf(';', cursor);
    const chunk = (semi === -1 ? body.slice(cursor) : body.slice(cursor, semi)).trim();
    const stmtLine = bodyStartLine + body.slice(0, cursor).split('\n').length - 1;
    cursor = semi === -1 ? body.length : semi + 1;

    if (!chunk) continue;

    if (semi === -1) {
      errors.push({
        line: stmtLine,
        column: 1,
        message: `Missing semicolon ";" after "${chunk.slice(0, 32)}".`,
        suggestion: 'Terminate every wire and assign statement with ";".',
      });
      break;
    }

    const wireMatch = chunk.match(/^wire\s+(.+)$/);
    if (wireMatch) {
      const names = wireMatch[1].split(',').map((s) => s.trim());
      for (const n of names) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) {
          errors.push({
            line: stmtLine,
            column: 1,
            message: `Invalid wire identifier "${n}".`,
            suggestion: 'Use alphanumeric identifiers starting with a letter or underscore.',
          });
        } else if (declaredSignals.has(n)) {
          warnings.push({
            line: stmtLine,
            column: 1,
            message: `Signal "${n}" is already declared.`,
            suggestion: 'Remove the redundant wire declaration.',
          });
        } else {
          declaredSignals.add(n);
          internalWires.push(n);
        }
      }
      continue;
    }

    const assignMatch = chunk.match(/^assign\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (assignMatch) {
      const target = assignMatch[1];
      const exprText = assignMatch[2].trim();
      const targetPort = ports.find((p) => p.name === target);
      if (targetPort?.direction === 'input') {
        errors.push({
          line: stmtLine,
          column: 1,
          message: `Cannot assign to input port "${target}".`,
          suggestion: 'Only output ports and internal wires can be driven by assign statements.',
        });
        continue;
      }
      if (!declaredSignals.has(target)) {
        errors.push({
          line: stmtLine,
          column: 1,
          message: `Undeclared assignment target "${target}".`,
          suggestion: `Declare "${target}" as an output wire or internal wire.`,
        });
        continue;
      }
      try {
        const tokens = tokenizeExpression(exprText, stmtLine, 1);
        const expr = parseExpressionTokens(tokens, stmtLine);
        // Validate referenced identifiers
        const refs = collectIdentifiers(expr);
        for (const r of refs) {
          if (!declaredSignals.has(r)) {
            errors.push({
              line: stmtLine,
              column: 1,
              message: `Undeclared signal "${r}" in assign statement.`,
              suggestion: `Add "${r}" to the module ports or declare "wire ${r};".`,
            });
          }
        }
        assignments.push({ target, expr, line: stmtLine });
      } catch (err) {
        errors.push(err as HDLError);
      }
      continue;
    }

    errors.push({
      line: stmtLine,
      column: 1,
      message: `Unrecognized statement "${chunk.slice(0, 40)}".`,
      suggestion: 'Supported body statements are "wire <name>;" and "assign <target> = <expr>;".',
    });
  }

  if (ports.filter((p) => p.direction === 'output').length === 0) {
    warnings.push({
      line: 1,
      column: 1,
      message: 'Module defines no output ports.',
      suggestion: 'Add at least one "output wire y" to observe simulation results.',
    });
  }

  return {
    success: errors.length === 0,
    ast: errors.length === 0 ? { name: moduleName, ports, internalWires, assignments } : null,
    errors,
    warnings,
  };
}

function collectIdentifiers(expr: HDLExpr): string[] {
  switch (expr.kind) {
    case 'ident':
      return [expr.name];
    case 'const':
      return [];
    case 'unary':
      return collectIdentifiers(expr.operand);
    case 'binary':
      return [...collectIdentifiers(expr.left), ...collectIdentifiers(expr.right)];
    case 'ternary':
      return [
        ...collectIdentifiers(expr.condition),
        ...collectIdentifiers(expr.whenTrue),
        ...collectIdentifiers(expr.whenFalse),
      ];
  }
}

function evalExpr(expr: HDLExpr, env: Record<string, 0 | 1 | 'X'>): 0 | 1 | 'X' {
  switch (expr.kind) {
    case 'const':
      return expr.value;
    case 'ident':
      return env[expr.name] ?? 'X';
    case 'unary': {
      const v = evalExpr(expr.operand, env);
      if (v === 'X') return 'X';
      return v === 1 ? 0 : 1;
    }
    case 'binary': {
      const l = evalExpr(expr.left, env);
      const r = evalExpr(expr.right, env);
      if (expr.op === '&') {
        if (l === 0 || r === 0) return 0;
        if (l === 1 && r === 1) return 1;
        return 'X';
      }
      if (expr.op === '|') {
        if (l === 1 || r === 1) return 1;
        if (l === 0 && r === 0) return 0;
        return 'X';
      }
      if (expr.op === '^') {
        if (l === 'X' || r === 'X') return 'X';
        return l !== r ? 1 : 0;
      }
      if (expr.op === '~&') {
        if (l === 0 || r === 0) return 1;
        if (l === 1 && r === 1) return 0;
        return 'X';
      }
      if (expr.op === '~|') {
        if (l === 1 || r === 1) return 0;
        if (l === 0 && r === 0) return 1;
        return 'X';
      }
      if (expr.op === '~^') {
        if (l === 'X' || r === 'X') return 'X';
        return l === r ? 1 : 0;
      }
      return 'X';
    }
    case 'ternary': {
      const c = evalExpr(expr.condition, env);
      if (c === 1) return evalExpr(expr.whenTrue, env);
      if (c === 0) return evalExpr(expr.whenFalse, env);
      return 'X';
    }
  }
}

export function evaluateHDLModule(
  ast: HDLModuleAST,
  inputVector: Record<string, 0 | 1>
): Record<string, 0 | 1 | 'X'> {
  const env: Record<string, 0 | 1 | 'X'> = {};
  for (const p of ast.ports) {
    env[p.name] = p.direction === 'input' ? (inputVector[p.name] ?? 0) : 'X';
  }
  for (const w of ast.internalWires) {
    env[w] = 'X';
  }

  // Iterative settle for chained internal wires
  for (let pass = 0; pass < ast.assignments.length + 2; pass++) {
    let changed = false;
    for (const a of ast.assignments) {
      const next = evalExpr(a.expr, env);
      if (env[a.target] !== next) {
        env[a.target] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const outputs: Record<string, 0 | 1 | 'X'> = {};
  for (const p of ast.ports) {
    if (p.direction === 'output') {
      outputs[p.name] = env[p.name];
    }
  }
  return outputs;
}

export function generateHDLTruthTable(ast: HDLModuleAST, maxInputs = 5): HDLSimulationRow[] {
  const inputs = ast.ports.filter((p) => p.direction === 'input');
  const limited = inputs.slice(0, maxInputs);
  const rows: HDLSimulationRow[] = [];
  const total = 1 << limited.length;

  for (let mask = 0; mask < total; mask++) {
    const vec: Record<string, 0 | 1> = {};
    for (let i = 0; i < limited.length; i++) {
      const bit = (mask >> (limited.length - 1 - i)) & 1;
      vec[limited[i].name] = bit as 0 | 1;
    }
    rows.push({
      inputs: vec,
      outputs: evaluateHDLModule(ast, vec),
    });
  }
  return rows;
}

// Synthesizes a parsed HDL module directly into a working Circuit Studio schematic!
export function synthesizeHDLToCircuit(ast: HDLModuleAST): CircuitDocument {
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];
  const signalDriver = new Map<string, { nodeId: string; pinId: string }>();

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}_${idCounter++}`;

  const inputs = ast.ports.filter((p) => p.direction === 'input');
  const outputs = ast.ports.filter((p) => p.direction === 'output');

  // Column 0: Input switches
  inputs.forEach((p, idx) => {
    const id = nextId('in');
    nodes.push({
      id,
      type: 'TOGGLE_SWITCH',
      label: p.name.toUpperCase(),
      x: 80,
      y: 80 + idx * 96,
      rotation: 0,
      value: 0,
    });
    signalDriver.set(p.name, { nodeId: id, pinId: 'out' });
  });

  // Track layout columns for synthesized gates
  const colY: Record<number, number> = {};
  const allocPos = (col: number) => {
    const y = colY[col] ?? 80;
    colY[col] = y + 92;
    return { x: 80 + col * 190, y };
  };

  let maxCol = 1;

  const synthExpr = (expr: HDLExpr): { nodeId: string; pinId: string; col: number } => {
    if (expr.kind === 'ident') {
      const drv = signalDriver.get(expr.name);
      if (drv) return { ...drv, col: 0 };
      const pos = allocPos(1);
      const id = nextId('c0');
      nodes.push({ id, type: 'CONST_0', label: '0', x: pos.x, y: pos.y, rotation: 0 });
      return { nodeId: id, pinId: 'out', col: 1 };
    }
    if (expr.kind === 'const') {
      const pos = allocPos(1);
      const id = nextId('const');
      nodes.push({
        id,
        type: expr.value === 1 ? 'CONST_1' : 'CONST_0',
        label: String(expr.value),
        x: pos.x,
        y: pos.y,
        rotation: 0,
      });
      return { nodeId: id, pinId: 'out', col: 1 };
    }
    if (expr.kind === 'unary') {
      const src = synthExpr(expr.operand);
      const col = src.col + 1;
      maxCol = Math.max(maxCol, col);
      const pos = allocPos(col);
      const id = nextId('not');
      nodes.push({ id, type: 'NOT', label: 'NOT', x: pos.x, y: pos.y, rotation: 0 });
      wires.push({
        id: nextId('w'),
        fromNodeId: src.nodeId,
        fromPinId: src.pinId,
        toNodeId: id,
        toPinId: 'a',
      });
      return { nodeId: id, pinId: 'y', col };
    }
    if (expr.kind === 'binary') {
      const l = synthExpr(expr.left);
      const r = synthExpr(expr.right);
      const col = Math.max(l.col, r.col) + 1;
      maxCol = Math.max(maxCol, col);
      const pos = allocPos(col);
      const gateType =
        expr.op === '&'
          ? 'AND'
          : expr.op === '|'
            ? 'OR'
            : expr.op === '^'
              ? 'XOR'
              : expr.op === '~&'
                ? 'NAND'
                : expr.op === '~|'
                  ? 'NOR'
                  : 'XNOR';
      const id = nextId(gateType.toLowerCase());
      nodes.push({ id, type: gateType, label: gateType, x: pos.x, y: pos.y, rotation: 0 });
      wires.push({
        id: nextId('w'),
        fromNodeId: l.nodeId,
        fromPinId: l.pinId,
        toNodeId: id,
        toPinId: 'a',
      });
      wires.push({
        id: nextId('w'),
        fromNodeId: r.nodeId,
        fromPinId: r.pinId,
        toNodeId: id,
        toPinId: 'b',
      });
      return { nodeId: id, pinId: 'y', col };
    }
    // Ternary -> 2:1 MUX
    const c = synthExpr(expr.condition);
    const t = synthExpr(expr.whenTrue);
    const f = synthExpr(expr.whenFalse);
    const col = Math.max(c.col, t.col, f.col) + 1;
    maxCol = Math.max(maxCol, col);
    const pos = allocPos(col);
    const id = nextId('mux');
    nodes.push({ id, type: 'MUX_2TO1', label: 'MUX', x: pos.x, y: pos.y, rotation: 0 });
    wires.push(
      { id: nextId('w'), fromNodeId: f.nodeId, fromPinId: f.pinId, toNodeId: id, toPinId: 'd0' },
      { id: nextId('w'), fromNodeId: t.nodeId, fromPinId: t.pinId, toNodeId: id, toPinId: 'd1' },
      { id: nextId('w'), fromNodeId: c.nodeId, fromPinId: c.pinId, toNodeId: id, toPinId: 'sel' }
    );
    return { nodeId: id, pinId: 'y', col };
  };

  // Synthesize internal wire assignments first, then output assignments
  const ordered = [
    ...ast.assignments.filter((a) => ast.internalWires.includes(a.target)),
    ...ast.assignments.filter((a) => !ast.internalWires.includes(a.target)),
  ];

  for (const assign of ordered) {
    const res = synthExpr(assign.expr);
    signalDriver.set(assign.target, { nodeId: res.nodeId, pinId: res.pinId });
  }

  // Output column
  const outX = 80 + (maxCol + 1) * 190;
  outputs.forEach((p, idx) => {
    const id = nextId('out');
    nodes.push({
      id,
      type: 'LED',
      label: p.name.toUpperCase(),
      x: outX,
      y: 80 + idx * 96,
      rotation: 0,
    });
    const drv = signalDriver.get(p.name);
    if (drv) {
      wires.push({
        id: nextId('w'),
        fromNodeId: drv.nodeId,
        fromPinId: drv.pinId,
        toNodeId: id,
        toPinId: 'in',
      });
    }
  });

  const now = Date.now();
  return {
    id: `hdl-synth-${now}`,
    name: `${ast.name} (Synthesized)`,
    description: `Synthesized from HDL module ${ast.name}`,
    nodes,
    wires,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
