package pe.com.fabrizio.cajalima.account.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.account.dto.*;
import pe.com.fabrizio.cajalima.account.service.CustomerAccountService;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;

@RestController @RequestMapping("/api/customers/{customerId}")
public class CustomerAccountController {
    private final CustomerAccountService accounts;
    public CustomerAccountController(CustomerAccountService accounts){this.accounts=accounts;}
    @GetMapping("/account") public CustomerAccountService.Account account(@PathVariable Long customerId){return accounts.account(customerId);}
    @GetMapping("/account/movements") public CustomerAccountService.MovementPage movements(@PathVariable Long customerId,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return accounts.list(customerId,page,size);}
    @PostMapping("/payments") @ResponseStatus(HttpStatus.CREATED)
    public AccountMovementResponse pay(@PathVariable Long customerId,@Valid @RequestBody PaymentRequest request,@AuthenticationPrincipal UserResponse actor){return accounts.pay(customerId,request,actor.id());}
}
