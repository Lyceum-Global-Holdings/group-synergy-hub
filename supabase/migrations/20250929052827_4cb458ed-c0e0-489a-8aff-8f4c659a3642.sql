-- Add trigger for auto-generating CPO numbers
CREATE TRIGGER auto_generate_cpo_number_trigger
  BEFORE INSERT ON customer_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION auto_generate_cpo_number();