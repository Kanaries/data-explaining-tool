import React from 'react';
import { Record, IField } from '../interfaces';
import styled from 'styled-components';
import { DropdownSelect } from '@tableau/tableau-ui';
import { T } from 'antd/lib/upload/utils';
import produce from 'immer';

interface TableProps {
    fields: IField[];
    dataSource: Record[];
    size?: number;
    onFieldsUpdate: (fields: IField[]) => void
}
const Container = styled.div`
    overflow-x: auto;
    table {
        box-sizing: content-box;
        font-family: Lato, 'Helvetica Neue', Arial, Helvetica, sans-serif;
        border-collapse: collapse;
        font-size: 12px;
        thead {
            th {
                text-align: left;
                border: 1px solid #f5f5f5;
                padding: 8px;
                margin: 2px;
            }
            th.number {
                border-top: 3px solid #5cdbd3;
            }
            th.text {
                border-top: 3px solid #69c0ff;
            }
        }
        tbody {
            td {
                border: 1px solid #f5f5f5;
                padding: 0px 8px;
            }
            td.number {
                text-align: right;
            }
            td.text {
                text-align: left;
            }
        }
    }
`;
const TYPE_LIST = [
    {
        value: 'dimension',
        label: '维度'
    },
    {
        value: 'measure',
        label: '度量'
    }
];
function getCellType(field: IField): 'number' | 'text' {
    return field.type === 'number' || field.type === 'integer' ? 'number' : 'text';
}
function getHeaderType(field: IField): 'number' | 'text' {
    return field.analyticType === 'dimension'? 'text' : 'number';
}
const Table: React.FC<TableProps> = props => {
    const { fields, dataSource, size = 10, onFieldsUpdate } = props;
    return (
        <Container>
            <table>
                <thead>
                    <tr>
                        {fields.map((field, fIndex) => (
                            <th key={field.key} className={getHeaderType(field)}>
                                <b>{field.key}</b>({field.type})
                                <div>
                                    <DropdownSelect kind="line" value={field.analyticType} onChange={(e) => {
                                        const nextFields = produce(fields, draft => {
                                            draft[fIndex].analyticType = e.target.value as any;
                                        })
                                        onFieldsUpdate(nextFields);
                                    }}>
                                        {
                                            TYPE_LIST.map(type => <option key={type.value} value={type.value}>{type.label}</option>)
                                        }
                                    </DropdownSelect>
                                </div>

                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {dataSource.slice(0, size).map((record, index) => (
                        <tr key={index}>
                            {fields.map((field) => (
                                <td
                                    key={field.key + index}
                                    className={getCellType(field)}
                                >
                                    {record[field.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Container>
    );
}

export default Table;
