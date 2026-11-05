export type RuleCondition = {
  field: "callType" | "status" | "districtId" | "stateId" | "companyId" | "priority" | "source" | "ageHours" | "brandId";
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value: string | number;
};

export type RuleAction =
  | { type: "escalate" }
  | { type: "notify"; channel?: string }
  | { type: "setPriority"; value: string }
  | { type: "setStatus"; value: string };

export type RuleDefinition = {
  all: RuleCondition[];
  actions: RuleAction[];
};

export type RuleContext = {
  callType: string;
  status: string;
  districtId: string | null;
  stateId: string | null;
  companyId: string;
  priority: string;
  source: string;
  brandId: string | null;
  ageHours: number;
};

export function parseRule(raw: string): RuleDefinition | null {
  try {
    const value = JSON.parse(raw) as RuleDefinition;
    if (!value || !Array.isArray(value.all) || !Array.isArray(value.actions)) return null;
    return value;
  } catch {
    return null;
  }
}

export function matchesRule(rule: RuleDefinition, ctx: RuleContext) {
  return rule.all.every((condition) => {
    const current = ctx[condition.field];
    const expected = condition.value;
    if (condition.field === "ageHours") {
      const age = Number(current);
      const target = Number(expected);
      if (condition.op === "gt") return age > target;
      if (condition.op === "gte") return age >= target;
      if (condition.op === "lt") return age < target;
      if (condition.op === "lte") return age <= target;
      if (condition.op === "eq") return age === target;
      return age !== target;
    }
    const left = current == null ? "" : String(current);
    const right = String(expected);
    if (condition.op === "neq") return left !== right;
    return left === right;
  });
}
