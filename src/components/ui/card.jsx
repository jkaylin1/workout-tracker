import PropTypes from 'prop-types';
import { cn } from "@/lib/utils";

const Card = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
};

const CardContent = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </div>
  );
};

Card.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

CardHeader.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

CardContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node
};

export { Card, CardHeader, CardContent };