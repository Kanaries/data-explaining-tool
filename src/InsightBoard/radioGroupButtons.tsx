import React from 'react';
import styled from 'styled-components';

const RGBContainer = styled.div`
  .option{
    padding: 1em;
    margin: 4px;
    border: 1px solid #f0f0f0;
    cursor: pointer;
  }
`

export interface RGBOption {
  label: string;
  value: any;
}

interface RadioGroupButtonsProps {
  options: RGBOption[];
  onChange?: (value: any, index: number) => void
}

const RadioGroupButtons: React.FC<RadioGroupButtonsProps> = props => {
  const { options, onChange } = props;
  return <RGBContainer>
    {
      options.map((op, i) => <div key={i} className="option" onClick={() => {
        if (onChange) {
          onChange(op.value, i);
        }
      }}>{op.label}</div>)
    }
  </RGBContainer>
}

export default RadioGroupButtons;
