export interface HDLPort {
  name: string;
  direction: 'input' | 'output';
  width: number; // Educational subset supports 1-bit scalar wires
}

export type HDLExpr =
  | { kind: 'ident'; name: string }
  | { kind: 'const'; value: 0 | 1 }
  | { kind: 'unary'; op: '~' | '!'; operand: HDLExpr }
  | { kind: 'binary'; op: '&' | '|' | '^' | '~&' | '~|' | '~^'; left: HDLExpr; right: HDLExpr }
  | { kind: 'ternary'; condition: HDLExpr; whenTrue: HDLExpr; whenFalse: HDLExpr };

export interface HDLAssign {
  target: string;
  expr: HDLExpr;
  line: number;
}

export interface HDLModuleAST {
  name: string;
  ports: HDLPort[];
  internalWires: string[];
  assignments: HDLAssign[];
}

export interface HDLError {
  line: number;
  column: number;
  message: string;
  suggestion: string;
}

export interface HDLParseResult {
  success: boolean;
  ast: HDLModuleAST | null;
  errors: HDLError[];
  warnings: HDLError[];
}

export interface HDLSimulationRow {
  inputs: Record<string, 0 | 1>;
  outputs: Record<string, 0 | 1 | 'X'>;
}
