import React from 'react';
import { cn } from './cn';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

interface CardSectionProps {
  className?: string;
  children: React.ReactNode;
}

function CardRoot({ className, children }: CardProps) {
  return (
    <div className={cn('border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden', className)}>
      {children}
    </div>
  );
}

function CardHeader({ className, children }: CardSectionProps) {
  return (
    <div className={cn('px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

function CardBody({ className, children }: CardSectionProps) {
  return (
    <div className={cn('p-5', className)}>
      {children}
    </div>
  );
}

function CardFooter({ className, children }: CardSectionProps) {
  return (
    <div className={cn('px-5 py-4 border-t border-slate-100 dark:border-slate-800', className)}>
      {children}
    </div>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body:   CardBody,
  Footer: CardFooter,
});
