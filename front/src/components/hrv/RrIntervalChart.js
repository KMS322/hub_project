import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const RrIntervalChart = ({ hrvData }) => {
  if (!hrvData || hrvData.length === 0) return null;

  return (
    <div className="chart-container">
      <h3>RR Interval 시계열</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={hrvData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="index" 
            label={{ value: "순서", position: "insideBottomRight", offset: -5 }}
          />
          <YAxis 
            label={{ value: "RR (ms)", angle: -90, position: "insideLeft" }}
            domain={['dataMin', 'dataMax']}
          />
          <Tooltip 
            formatter={(value, name) => [value, "RR"]}
            labelFormatter={(label) => `순서: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="rr" 
            stroke="#4CAF50" 
            strokeWidth={2}
            dot={{ fill: '#4CAF50', strokeWidth: 2, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RrIntervalChart;

