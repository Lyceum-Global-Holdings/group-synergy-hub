
# Stock Desync Warning Banner on Item Master Tab

## What This Does

Adds a dismissible amber/red warning banner at the top of the **Item Master** tab that automatically appears when any desynced items are detected. It shows the count of desynced items and a "Go to Stock Audit" button that switches to the audit tab. Users are alerted immediately without having to manually navigate away.

## How It Works

The `useStockAudit` hook already computes the `summary.desynced` count. The banner will reuse that same hook — no extra database queries are needed. Because `useStockAudit` is already used by `StockAuditTab`, the query result is cached by React Query and shared for free.

The tab switch is controlled by lifting `value` state from `<Tabs>` up to `ItemBinMaster.tsx`, then passing a `onGoToAudit` callback down to `ItemMasterTab` which the banner's button calls.

## Files to Change

| File | Change |
|---|---|
| `src/pages/warehouse/ItemBinMaster.tsx` | Lift tab state, pass `onGoToAudit` prop to `ItemMasterTab` |
| `src/components/warehouse/ItemMasterTab.tsx` | Accept `onGoToAudit` prop, render desync warning banner |

No new files, no new hooks, no database changes.

## Detailed Changes

### 1. `src/pages/warehouse/ItemBinMaster.tsx`

Convert `<Tabs>` from uncontrolled (`defaultValue`) to controlled (`value` + `onValueChange`) using a `useState`:

```tsx
const [activeTab, setActiveTab] = useState('items');

<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
  ...
  <TabsContent value="items">
    <ItemMasterTab onGoToAudit={() => setActiveTab('audit')} />
  </TabsContent>
```

This is a minimal, non-breaking change — the rest of the tabs and tab contents remain unchanged.

### 2. `src/components/warehouse/ItemMasterTab.tsx`

**Props interface addition:**
```tsx
interface ItemMasterTabProps {
  onGoToAudit?: () => void;
}

export function ItemMasterTab({ onGoToAudit }: ItemMasterTabProps) {
```

**Import `useStockAudit` and `Alert`:**
```tsx
import { useStockAudit } from '@/hooks/useStockAudit';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
```

**Banner logic — placed at the very top of the returned JSX, before the filter row:**
```tsx
const { summary } = useStockAudit();

// In JSX:
{summary.desynced > 0 && (
  <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    <AlertDescription className="flex items-center justify-between">
      <span>
        <strong>{summary.desynced} item{summary.desynced > 1 ? 's have' : ' has'} a stock desync</strong>
        {' '}— the item master stock does not match bin allocation totals.
      </span>
      {onGoToAudit && (
        <Button
          variant="outline"
          size="sm"
          className="ml-4 border-amber-400 text-amber-800 hover:bg-amber-100 shrink-0"
          onClick={onGoToAudit}
        >
          <ShieldAlert className="mr-1 h-3 w-3" />
          Go to Stock Audit
        </Button>
      )}
    </AlertDescription>
  </Alert>
)}
```

The banner only renders when `summary.desynced > 0`, so it is invisible when everything is in sync. The React Query cache means no extra network call is made — the audit data was already fetched when the hook was mounted.

## Visual Result

When desyncs exist:
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ 3 items have a stock desync — the item master stock does not   │
│   match bin allocation totals.         [Go to Stock Audit →]     │
└──────────────────────────────────────────────────────────────────┘
[Search]  [Category ▾]  [Bin ▾]  [Status ▾]  [Supplier ▾]     [Add Items]
```

When everything is in sync: the banner is completely absent.
