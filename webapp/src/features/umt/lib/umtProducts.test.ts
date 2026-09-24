// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtBaseProduct } from "../api/umtProducts";
import {
  EMPTY_CREATE_PRODUCT_FORM,
  buildUmtCreateProductRequest,
  isCreateProductFormValid,
  productRowId,
  type UmtCreateProductFormValues,
} from "./umtProducts";

function form(overrides: Partial<UmtCreateProductFormValues> = {}): UmtCreateProductFormValues {
  return {
    name: "wso2am",
    version: "4.0.0",
    leadMail: "lead@wso2.com",
    edMail: "ed@wso2.com",
    ftpHost: "ftp.wso2.com",
    ftpPort: "21",
    ftpUsername: "ftpuser",
    ftpPassword: "secret",
    ftpAbsolutePath: "/updates",
    ...overrides,
  };
}

function baseProduct(overrides: Partial<UmtBaseProduct> = {}): UmtBaseProduct {
  return {
    name: "wso2am",
    version: "4.0.0.0.full",
    isActive: true,
    createdBy: "admin@wso2.com",
    createdOn: "2026-01-01 09:14:22.0",
    ...overrides,
  };
}

describe("productRowId", () => {
  it("combines name and version into a composite id", () => {
    expect(productRowId(baseProduct())).toBe(JSON.stringify(["wso2am", "4.0.0.0.full"]));
  });

  it("does not collide when a hyphen moves between name and version", () => {
    const a = productRowId(baseProduct({ name: "foo-bar", version: "1.0.full" }));
    const b = productRowId(baseProduct({ name: "foo", version: "bar-1.0.full" }));
    expect(a).not.toBe(b);
  });
});

describe("isCreateProductFormValid", () => {
  it("accepts a fully populated form", () => {
    expect(isCreateProductFormValid(form())).toBe(true);
  });

  it("rejects the empty form", () => {
    expect(isCreateProductFormValid(EMPTY_CREATE_PRODUCT_FORM)).toBe(false);
  });

  it("rejects a form with any single blank or whitespace-only field", () => {
    expect(isCreateProductFormValid(form({ name: "" }))).toBe(false);
    expect(isCreateProductFormValid(form({ ftpPassword: "   " }))).toBe(false);
  });
});

describe("buildUmtCreateProductRequest", () => {
  it("trims every field except the password and suffixes the version with .0.full", () => {
    expect(
      buildUmtCreateProductRequest(
        form({
          name: "  wso2am  ",
          version: "  4.0.0  ",
          ftpPassword: "  secret  ",
        }),
      ),
    ).toEqual({
      name: "wso2am",
      version: "4.0.0.0.full",
      leadMail: "lead@wso2.com",
      edMail: "ed@wso2.com",
      ftpHost: "ftp.wso2.com",
      ftpPort: "21",
      ftpUsername: "ftpuser",
      ftpPassword: "  secret  ",
      ftpAbsolutePath: "/updates",
    });
  });
});
