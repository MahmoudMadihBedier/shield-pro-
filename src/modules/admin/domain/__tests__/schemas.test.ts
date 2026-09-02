import { describe, expect, it } from 'vitest'

import {
  branchRowSchema,
  customerInputSchema,
  customerRowSchema,
  productInputSchema,
  productBomLineInputSchema,
  rawMaterialInputSchema,
  warehouseInputSchema,
} from '../schemas'

const validCustomer = {
  code: 'cust-01',
  name: 'متجر النور',
  branch_id: 'br-1',
  geo: '30.0444,31.2357',
  discount_pct: 10,
  credit_limit: 5000,
  payment_terms_days: 30,
}

describe('customerInputSchema — geo', () => {
  it('requires geo on create', () => {
    const { geo, ...noGeo } = validCustomer
    void geo
    expect(customerInputSchema.safeParse(noGeo).success).toBe(false)
  })

  it('accepts two comma-separated floats', () => {
    expect(customerInputSchema.parse(validCustomer).geo).toBe('30.0444,31.2357')
  })

  it('accepts negative / integer coordinates', () => {
    expect(customerInputSchema.parse({ ...validCustomer, geo: '-1,2' }).geo).toBe('-1,2')
  })

  it('rejects a single coordinate', () => {
    expect(customerInputSchema.safeParse({ ...validCustomer, geo: '30.0444' }).success).toBe(false)
  })

  it('rejects a non-numeric geo', () => {
    expect(
      customerInputSchema.safeParse({ ...validCustomer, geo: 'Cairo, Egypt' }).success,
    ).toBe(false)
  })
})

describe('percentage bounds', () => {
  it('accepts 0 and 100', () => {
    expect(customerInputSchema.parse({ ...validCustomer, discount_pct: 0 }).discount_pct).toBe(0)
    expect(customerInputSchema.parse({ ...validCustomer, discount_pct: 100 }).discount_pct).toBe(100)
  })

  it('rejects a discount above 100', () => {
    expect(customerInputSchema.safeParse({ ...validCustomer, discount_pct: 101 }).success).toBe(
      false,
    )
  })

  it('rejects a negative discount', () => {
    expect(customerInputSchema.safeParse({ ...validCustomer, discount_pct: -1 }).success).toBe(false)
  })

  it('bounds product default_discount_pct and allowed_waste_pct to 0..100', () => {
    const base = { code: 'P1', name: 'X', uom: 'pc', base_price: 1, is_active: true }
    expect(
      productInputSchema.safeParse({
        ...base,
        default_discount_pct: 50,
        allowed_waste_pct: 5,
      }).success,
    ).toBe(true)
    expect(
      productInputSchema.safeParse({
        ...base,
        default_discount_pct: 150,
        allowed_waste_pct: 5,
      }).success,
    ).toBe(false)
  })
})

describe('product base_price', () => {
  const base = {
    code: 'P1',
    name: 'X',
    uom: 'pc',
    default_discount_pct: 0,
    allowed_waste_pct: 0,
    is_active: true,
  }
  it('accepts zero', () => {
    expect(productInputSchema.parse({ ...base, base_price: 0 }).base_price).toBe(0)
  })
  it('rejects a negative price', () => {
    expect(productInputSchema.safeParse({ ...base, base_price: -0.01 }).success).toBe(false)
  })
})

describe('code normalization', () => {
  it('trims and uppercases product code', () => {
    const parsed = productInputSchema.parse({
      code: '  a-17 ',
      name: 'X',
      uom: 'pc',
      base_price: 1,
      default_discount_pct: 0,
      allowed_waste_pct: 0,
      is_active: true,
    })
    expect(parsed.code).toBe('A-17')
  })

  it('trims and uppercases raw-material code', () => {
    const parsed = rawMaterialInputSchema.parse({
      code: 'flour-x ',
      name: 'دقيق',
      uom: 'kg',
      purchase_price: 0,
      reorder_point: 0,
    })
    expect(parsed.code).toBe('FLOUR-X')
  })

  it('rejects a blank code', () => {
    expect(
      rawMaterialInputSchema.safeParse({
        code: '   ',
        name: 'x',
        uom: 'kg',
        purchase_price: 0,
        reorder_point: 0,
      }).success,
    ).toBe(false)
  })
})

describe('warehouse kind enum', () => {
  it('accepts a schema kind', () => {
    expect(
      warehouseInputSchema.parse({ name: 'مخزن', kind: 'sub', is_active: true }).kind,
    ).toBe('sub')
  })
  it('rejects an unknown kind', () => {
    expect(
      warehouseInputSchema.safeParse({ name: 'مخزن', kind: 'showroom', is_active: true }).success,
    ).toBe(false)
  })
})

describe('BOM line input', () => {
  it('requires qty_per_unit strictly greater than zero', () => {
    expect(
      productBomLineInputSchema.safeParse({
        product_id: 'p1',
        raw_material_id: 'rm1',
        qty_per_unit: 0,
      }).success,
    ).toBe(false)
    expect(
      productBomLineInputSchema.parse({
        product_id: 'p1',
        raw_material_id: 'rm1',
        qty_per_unit: 0.5,
      }).qty_per_unit,
    ).toBe(0.5)
  })
})

describe('row schemas — Appwrite shape', () => {
  it('fills is_active from a missing/null value', () => {
    const row = branchRowSchema.parse({
      $id: 'b1',
      $createdAt: 't',
      $updatedAt: 't',
      name: 'الفرع الرئيسي',
      name_ar: null,
      location: null,
      sub_warehouse_id: null,
      branch_accountant_id: null,
      is_active: null,
    })
    expect(row.is_active).toBe(true)
  })

  it('parses a full customer row including approval_state', () => {
    const row = customerRowSchema.parse({
      $id: 'c1',
      $createdAt: 't',
      $updatedAt: 't',
      code: 'C1',
      name: 'عميل',
      phone: null,
      branch_id: 'br-1',
      geo: '30,31',
      discount_pct: 0,
      credit_limit: 0,
      payment_terms_days: 0,
      approval_state: 'pending_approval',
      created_by: null,
    })
    expect(row.approval_state).toBe('pending_approval')
  })
})
