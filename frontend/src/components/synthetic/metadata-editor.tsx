import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SYNTHETIC_SDTYPES,
  supportsPii,
  type SyntheticDefaults,
  type SyntheticSdtype,
} from "@/features/datasets/types";

export interface SyntheticColumnForm {
  sdtype: SyntheticSdtype;
  pii: boolean;
}

export interface SyntheticFormState {
  tableName: string;
  numRows: number;
  primaryKey: number | null;
  columns: Record<number, SyntheticColumnForm>;
}

export function initialFormState(defaults: SyntheticDefaults): SyntheticFormState {
  return {
    tableName: defaults.table_name,
    numRows: defaults.default_num_rows,
    primaryKey: defaults.suggested_primary_key,
    columns: Object.fromEntries(
      defaults.columns.map((column) => [
        column.index,
        { sdtype: column.sdtype, pii: column.pii },
      ]),
    ),
  };
}

interface MetadataEditorProps {
  defaults: SyntheticDefaults;
  form: SyntheticFormState;
  onChange: (form: SyntheticFormState) => void;
}

export function MetadataEditor({
  defaults,
  form,
  onChange,
}: MetadataEditorProps) {
  const setColumn = (index: number, next: SyntheticColumnForm) => {
    onChange({
      ...form,
      columns: { ...form.columns, [index]: next },
    });
  };

  const handleSdtypeChange = (index: number, sdtype: SyntheticSdtype) => {
    const current = form.columns[index];
    setColumn(index, {
      sdtype,
      pii: supportsPii(sdtype) ? (current?.pii ?? false) : false,
    });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card/40">
      <div className="grid gap-3 border-b border-border/60 p-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="synthetic-table-name" className="text-xs">
            Table name
          </Label>
          <Input
            id="synthetic-table-name"
            value={form.tableName}
            onChange={(event) =>
              onChange({ ...form, tableName: event.target.value })
            }
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="synthetic-num-rows" className="text-xs">
            Rows to generate
          </Label>
          <Input
            id="synthetic-num-rows"
            type="number"
            min={1}
            max={1_000_000}
            value={Number.isFinite(form.numRows) ? form.numRows : ""}
            onChange={(event) =>
              onChange({ ...form, numRows: event.target.valueAsNumber })
            }
            className="h-8 text-sm tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="synthetic-primary-key" className="text-xs">
            Primary key
          </Label>
          <Select
            value={form.primaryKey === null ? "none" : String(form.primaryKey)}
            onValueChange={(value) =>
              onChange({
                ...form,
                primaryKey: value === "none" ? null : Number(value),
              })
            }
          >
            <SelectTrigger
              id="synthetic-primary-key"
              size="sm"
              className="w-full"
            >
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {defaults.columns.map((column) => (
                <SelectItem key={column.index} value={String(column.index)}>
                  {column.header}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-h-64 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Column</th>
              <th className="px-3 py-2 font-medium">Data type</th>
              <th className="px-3 py-2 font-medium">Anonymize</th>
            </tr>
          </thead>
          <tbody>
            {defaults.columns.map((column) => {
              const value = form.columns[column.index] ?? {
                sdtype: column.sdtype,
                pii: column.pii,
              };
              const piiAvailable = supportsPii(value.sdtype);
              const isPrimaryKey = form.primaryKey === column.index;
              return (
                <tr
                  key={column.index}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="max-w-56 truncate px-3 py-1.5 font-medium" title={column.header}>
                    {column.header}
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={value.sdtype}
                      onValueChange={(next) =>
                        handleSdtypeChange(column.index, next as SyntheticSdtype)
                      }
                    >
                      <SelectTrigger size="sm" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYNTHETIC_SDTYPES.map((sdtype) => (
                          <SelectItem key={sdtype.value} value={sdtype.value}>
                            {sdtype.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary disabled:opacity-40"
                        checked={piiAvailable && value.pii}
                        disabled={!piiAvailable || isPrimaryKey}
                        onChange={(event) =>
                          setColumn(column.index, {
                            ...value,
                            pii: event.target.checked,
                          })
                        }
                      />
                      <span className="text-muted-foreground">
                        {isPrimaryKey
                          ? "Generated IDs"
                          : piiAvailable
                            ? "Replace values"
                            : "—"}
                      </span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
