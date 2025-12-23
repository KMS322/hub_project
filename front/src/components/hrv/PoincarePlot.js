import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PoincarePlot = ({ poincareData }) => {
  if (!poincareData || poincareData.length === 0) return null;

  return (
    <div className="chart-container">
      <h3>Poincare Plot</h3>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart data={poincareData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="x" 
            label={{ value: "RR(n) (ms)", position: "insideBottomRight", offset: -5 }}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis 
            dataKey="y" 
            label={{ value: "RR(n+1) (ms)", angle: -90, position: "insideLeft" }}
            domain={['dataMin', 'dataMax']}
          />
          <Tooltip 
            formatter={(value, name) => [value, name === 'x' ? 'RR(n)' : 'RR(n+1)']}
            labelFormatter={(label, payload) => 
              payload && payload[0] ? `RR(n): ${payload[0].value}ms, RR(n+1): ${payload[1].value}ms` : ''
            }
          />
          <Scatter dataKey="y" fill="#4CAF50" r={3}>
            {poincareData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#4CAF50" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PoincarePlot;

