import React from 'react';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className="table-container">
      <table className={`table ${className}`}>{children}</table>
    </div>
  );
};

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
  return <thead className={className}>{children}</thead>;
};

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
  return <tbody className={className}>{children}</tbody>;
};

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => {
  return (
    <tr 
      className={`${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

export interface TableHeadCellProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeadCell: React.FC<TableHeadCellProps> = ({ children, className = '' }) => {
  return <th className={className}>{children}</th>;
};

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '' }) => {
  return <td className={className}>{children}</td>;
};
