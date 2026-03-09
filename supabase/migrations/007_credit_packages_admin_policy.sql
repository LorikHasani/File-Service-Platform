-- Add admin management policy for credit_packages
-- (Previously only had a SELECT policy for active packages)

-- Allow admins to read ALL packages (including inactive)
CREATE POLICY "Admins can view all packages"
    ON credit_packages FOR SELECT
    USING (is_admin());

-- Allow admins full CRUD on credit_packages
CREATE POLICY "Admins can manage packages"
    ON credit_packages FOR ALL
    USING (is_admin());
