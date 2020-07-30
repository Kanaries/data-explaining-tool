
import { AggFC } from "cube-core/built/types";

export interface Record {
  [key: string]: any;
}

export interface Field {
  /**
   * id: key in data record
   */
  id: string;
  /**
   * display name for field
   */
  name: string;
  /**
   * aggregator's name
   */
  aggName?: string;
  type: 'D' | 'M';
  [key: string]: any;
  cmp?: (a: any, b: any) => number;
}

export interface Measure extends Field {
  aggregator?: AggFC;
  minWidth?: number;
  formatter?: (value: number | undefined) => number | string;
}

export type SemanticType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';

export interface Filters {
  [key: string]: any[];
}

export interface IField {
    key: string;
    type: string;
    analyticType: 'dimension' | 'measure';
}


export interface DataSet {
  id: string;
  name: string;
  fields: IField[];
  dataSource: Record[];
}

export interface IFieldNeighbor {
  key: string;
  cc: number;
}
