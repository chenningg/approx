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
  supportsRange,
  type ColumnInfo,
  type SyntheticDefaults,
  type SyntheticSdtype,
} from "@/features/datasets/types";

export interface SyntheticColumnForm {
  sdtype: SyntheticSdtype;
  pii: boolean;
  minValue: string;
  maxValue: string;
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
        {
          sdtype: column.sdtype,
          pii: column.pii,
          minValue: column.min_value ?? "",
          maxValue: column.max_value ?? "",
        },
      ]),
    ),
  };
}

interface MetadataEditorProps {
  defaults: SyntheticDefaults;
  form: SyntheticFormState;
  onChange: (form: SyntheticFormState) => void;
  columns?: ColumnInfo[];
}

export function MetadataEditor({
  defaults,
  form,
  onChange,
  columns,
}: MetadataEditorProps) {
  const setColumn = (index: number, next: SyntheticColumnForm) => {
    onChange({
      ...form,
      columns: { ...form.columns, [index]: next },
    });
  };

  // Observed range of a column, used to pre-fill the allowed range when a
  // column is switched to a type that supports one.
  const detectedRange = (index: number, sdtype: SyntheticSdtype) => {
    const column = columns?.find((entry) => entry.index === index);
    if (!column) return null;
    if (sdtype === "numerical") {
      return {
        min:
          column.numeric_min === null || column.numeric_min === undefined
            ? ""
            : String(column.numeric_min),
        max:
          column.numeric_max === null || column.numeric_max === undefined
            ? ""
            : String(column.numeric_max),
      };
    }
    if (sdtype === "datetime") {
      return {
        min: column.datetime_min ?? "",
        max: column.datetime_max ?? "",
      };
    }
    return null;
  };

  const handleSdtypeChange = (index: number, sdtype: SyntheticSdtype) => {
    const current = form.columns[index];
    const pii = supportsPii(sdtype) ? (current?.pii ?? false) : false;
    // A range only survives a type change when it stays the same kind of
    // range; otherwise the values no longer make sense.
    const keepRange =
      current !== undefined &&
      current.sdtype === sdtype &&
      supportsRange(sdtype);
    const detected = keepRange ? null : detectedRange(index, sdtype);
    onChange({
      ...form,
      // A primary key must stay an identifier, so changing its type away from
      // Identifier releases the key selection instead of leaving stale state.
      primaryKey:
        form.primaryKey === index && sdtype !== "id" ? null : form.primaryKey,
      columns: {
        ...form.columns,
        [index]: {
          sdtype,
          pii,
          minValue: keepRange ? current.minValue : (detected?.min ?? ""),
          maxValue: keepRange ? current.maxValue : (detected?.max ?? ""),
        },
      },
    });
  };

  const handlePrimaryKeyChange = (value: string) => {
    if (value === "none") {
      onChange({ ...form, primaryKey: null });
      return;
    }

    const index = Number(value);
    onChange({
      ...form,
      primaryKey: index,
      columns: {
        ...form.columns,
        [index]: { sdtype: "id", pii: false, minValue: "", maxValue: "" },
      },
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
            onValueChange={handlePrimaryKeyChange}
          >
            <SelectTrigger
              id="synthetic-primary-key"
              className="w-full cursor-pointer"
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
              <th
                className="px-3 py-2 font-medium"
                title="Optional: keep the generated values inside this range"
              >
                Allowed range
              </th>
            </tr>
          </thead>
          <tbody>
            {defaults.columns.map((column) => {
              const value = form.columns[column.index] ?? {
                sdtype: column.sdtype,
                pii: column.pii,
                minValue: column.min_value ?? "",
                maxValue: column.max_value ?? "",
              };
              const piiSupported = supportsPii(value.sdtype);
              const isPrimaryKey = form.primaryKey === column.index;
              const piiActive = piiSupported && !isPrimaryKey && value.pii;
              const rangeSupported = supportsRange(value.sdtype) && !isPrimaryKey;
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
                      <SelectTrigger size="sm" className="w-44 cursor-pointer">
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
                        className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        checked={piiActive}
                        disabled={!piiSupported || isPrimaryKey}
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
                          : piiSupported
                            ? "Replace values"
                            : "—"}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-1.5">
                    {rangeSupported ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type={value.sdtype === "datetime" ? "date" : "number"}
                          step="any"
                          value={value.minValue}
                          placeholder="Min"
                          aria-label={`Minimum allowed value for ${column.header}`}
                          onChange={(event) =>
                            setColumn(column.index, {
                              ...value,
                              minValue: event.target.value,
                            })
                          }
                          className="h-7 w-24 text-xs tabular-nums"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type={value.sdtype === "datetime" ? "date" : "number"}
                          step="any"
                          value={value.maxValue}
                          placeholder="Max"
                          aria-label={`Maximum allowed value for ${column.header}`}
                          onChange={(event) =>
                            setColumn(column.index, {
                              ...value,
                              maxValue: event.target.value,
                            })
                          }
                          className="h-7 w-24 text-xs tabular-nums"
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
