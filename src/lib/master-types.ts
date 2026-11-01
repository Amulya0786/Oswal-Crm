export type FieldType = "text" | "number" | "textarea" | "boolean" | "select" | "relation";

export type MasterFieldDTO = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  relation?: { name: string; model: string; label: string; parentKey?: string };
  fullWidth?: boolean;
};

export type MasterDefDTO = {
  key: string;
  label: string;
  group: string;
  blurb: string;
  fields: MasterFieldDTO[];
  columns: string[];
};

export type MasterRow = Record<string, unknown>;
